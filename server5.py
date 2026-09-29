"""Multi-provider SMM engine for Server 5.

Implements the conventional SMM Panel API while keeping provider identities and
raw errors admin-only. Database writes use short transactions and API calls are
never made while holding a SQLite lock.
"""
from __future__ import annotations
import asyncio, hashlib, html as html_lib, json, math, re, unicodedata
from dataclasses import dataclass, replace
from urllib.parse import urlsplit, urlunsplit
import aiohttp
from database import connect, transaction, utcnow
from secrets_manager import encrypt_secret, decrypt_secret

class SMMError(RuntimeError):
    def __init__(self, code, detail=""):
        self.code, self.detail = code, str(detail)[:1500]
        super().__init__(code)

def normalize_api_url(value):
    """Extract and normalize a panel URL copied from Telegram."""
    text=unicodedata.normalize("NFKC",str(value or ""))
    text="".join(ch for ch in text if unicodedata.category(ch) not in ("Cf","Cc","Cs"))
    match=re.search(r"(?i)https?\s*:\s*/\s*/[^\s<>\[\](){}\"']+",text)
    if match:text=match.group(0)
    text=re.sub(r"\s+","",text).strip("<>[](){}\"'.,;!?")
    if "://" not in text:text="https://"+text
    parts=urlsplit(text)
    if parts.scheme.casefold() not in ("http","https") or not parts.hostname or parts.username or parts.password:
        raise ValueError("A valid provider API URL is required")
    try:
        port=parts.port
    except ValueError as exc:
        raise ValueError("The provider API URL has an invalid port") from exc
    host=parts.hostname.encode("idna").decode("ascii").casefold()
    netloc=f"{host}:{port}" if port else host
    path=parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.casefold(),netloc,path,parts.query,""))

@dataclass(frozen=True)
class Quote:
    service_id:int; provider_id:int; quantity:int; cost:float; charge:float; profit:float

def log(action, detail, provider_id=None, order_id=None, level="info", admin_id=None):
    with transaction() as db:
        db.execute("INSERT INTO smm_logs(provider_id,order_id,admin_id,action,level,detail,created_at) VALUES(?,?,?,?,?,?,?)",
                   (provider_id,order_id,admin_id,action,level,str(detail)[:4000],utcnow()))

_order_locks={}

def _request_lock(request_id):
    lock=_order_locks.get(request_id)
    if lock is None:
        lock=asyncio.Lock();_order_locks[request_id]=lock
    return lock

class Client:
    def __init__(self, provider_id): self.provider_id=int(provider_id)
    def config(self):
        with connect() as db:r=db.execute("SELECT * FROM smm_providers WHERE id=? AND deleted_at IS NULL",(self.provider_id,)).fetchone()
        if not r:raise SMMError("PROVIDER_NOT_FOUND")
        return r
    async def request(self, action, **params):
        p=self.config()
        if not p["enabled"]:raise SMMError("PROVIDER_DISABLED")
        key=p["api_key"]; key=decrypt_secret(key[4:]) if key.startswith("enc:") else key
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
                async with session.post(p["api_url"],data={"key":key,"action":action,**params}) as response:
                    raw=await response.text()
                    if response.status>=400:raise SMMError("HTTP_ERROR",f"HTTP {response.status}: {raw}")
        except (aiohttp.ClientError,asyncio.TimeoutError) as exc:raise SMMError("NETWORK_ERROR",repr(exc)) from exc
        try:value=json.loads(raw)
        except json.JSONDecodeError as exc:raise SMMError("INVALID_JSON",raw) from exc
        if isinstance(value,dict) and value.get("error"):raise SMMError("PROVIDER_ERROR",value["error"])
        return value
    async def balance(self):
        value=await self.request("balance")
        try:return float(value["balance"]),str(value.get("currency") or self.config()["currency"])
        except (KeyError,TypeError,ValueError) as exc:raise SMMError("INVALID_BALANCE",value) from exc
    async def services(self):
        value=await self.request("services")
        if not isinstance(value,list):raise SMMError("INVALID_SERVICES",value)
        return value
    async def add(self,service,link,quantity):
        value=await self.request("add",service=service,link=link,quantity=quantity)
        if not isinstance(value,dict) or not value.get("order"):raise SMMError("ORDER_FAILED",value)
        return str(value["order"])
    async def status(self,order):
        value=await self.request("status",order=order)
        if not isinstance(value,dict):raise SMMError("INVALID_STATUS",value)
        return value
    async def refill(self,order):return await self.request("refill",order=order)
    async def cancel(self,order):return await self.request("cancel",orders=order)

async def test_provider(url,key):
    url=normalize_api_url(url)
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
        async with session.post(url,data={"key":key,"action":"balance"}) as response:
            raw=await response.text()
    try:
        value=json.loads(raw)
        if value.get("error"):raise SMMError("PROVIDER_ERROR",value["error"])
        return float(value["balance"]),str(value.get("currency","USD"))
    except (json.JSONDecodeError,KeyError,TypeError,ValueError) as exc:raise SMMError("CONNECTION_TEST_FAILED",raw) from exc

def add_provider(name,url,key,currency="USD"):
    url=normalize_api_url(url)
    if not name.strip() or not key.strip():raise ValueError("invalid provider")
    now=utcnow()
    with transaction(immediate=True) as db:
        pid=db.execute("INSERT INTO smm_providers(name,api_url,api_key,currency,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                       (name.strip(),url.strip(),"enc:"+encrypt_secret(key.strip()),currency.upper(),now,now)).lastrowid
    log("provider_added",name,pid);return pid

async def sync_provider(pid):
    client=Client(pid)
    try:
        services,balance_data=await asyncio.gather(client.services(),client.balance())
        balance,currency=balance_data; now=utcnow(); seen=[];cats=set()
        with transaction(immediate=True) as db:
            db.execute("UPDATE smm_providers SET balance=?,currency=?,last_sync=?,last_error=NULL,updated_at=? WHERE id=?",(balance,currency,now,now,pid))
            for item in services:
                try:
                    rid=str(item["service"]);name=str(item["name"]).strip();cat=str(item.get("category") or "Other").strip()
                    rate=float(item["rate"]);minimum=int(item["min"]);maximum=int(item["max"])
                    if not rid or not name or rate<0 or minimum<1 or maximum<minimum:continue
                except (KeyError,TypeError,ValueError):continue
                cats.add(cat);seen.append(rid)
                db.execute("INSERT INTO smm_categories(provider_id,remote_name,display_name) VALUES(?,?,?) ON CONFLICT(provider_id,remote_name) DO NOTHING",(pid,cat,cat))
                cid=db.execute("SELECT id FROM smm_categories WHERE provider_id=? AND remote_name=?",(pid,cat)).fetchone()[0]
                db.execute("""INSERT INTO smm_services(provider_id,category_id,remote_service_id,name,description,service_type,rate,minimum,maximum,average_time,refill,cancellable,dripfeed,provider_updated_at)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider_id,remote_service_id) DO UPDATE SET category_id=excluded.category_id,name=excluded.name,
                 description=excluded.description,service_type=excluded.service_type,rate=excluded.rate,minimum=excluded.minimum,maximum=excluded.maximum,
                 average_time=excluded.average_time,refill=excluded.refill,cancellable=excluded.cancellable,dripfeed=excluded.dripfeed,enabled=CASE WHEN smm_services.deleted_at IS NULL THEN 1 ELSE smm_services.enabled END,provider_updated_at=excluded.provider_updated_at WHERE smm_services.deleted_at IS NULL""",
                 (pid,cid,rid,name,str(item.get("description",'')),str(item.get("type","Default")),rate,minimum,maximum,str(item.get("average_time",'')),int(bool(item.get("refill"))),int(bool(item.get("cancel"))),int(bool(item.get("dripfeed"))),now))
            if seen:
                marks=','.join('?'*len(seen));db.execute(f"UPDATE smm_services SET enabled=0 WHERE deleted_at IS NULL AND provider_id=? AND remote_service_id NOT IN ({marks})",(pid,*seen))
        log("sync_finished",f"categories={len(cats)} services={len(seen)}",pid);return len(cats),len(seen)
    except Exception as exc:
        with transaction() as db:db.execute("UPDATE smm_providers SET last_error=?,updated_at=? WHERE id=?",(getattr(exc,'detail',str(exc)),utcnow(),pid))
        log("sync_failed",getattr(exc,'detail',str(exc)),pid,level="error");raise

def service_rows(query="",category_id=None,category_name=None,limit=500):
    sql="""SELECT s.*,c.display_name category_name,p.currency provider_currency,p.percent_markup,p.fixed_markup,p.exchange_rate,p.minimum_profit provider_min_profit,
      p.maximum_profit provider_max_profit,p.round_to,p.priority provider_priority FROM smm_services s JOIN smm_categories c ON c.id=s.category_id
      JOIN smm_providers p ON p.id=s.provider_id WHERE s.enabled=1 AND s.visible=1 AND s.deleted_at IS NULL AND c.visible=1 AND p.enabled=1 AND p.deleted_at IS NULL"""
    args=[]
    if query:sql+=" AND (LOWER(s.name) LIKE ? OR LOWER(s.tags) LIKE ? OR s.remote_service_id=?)";q=f"%{query.casefold()}%";args += [q,q,query]
    if category_id:sql+=" AND s.category_id=?";args.append(category_id)
    if category_name:sql+=" AND LOWER(c.display_name)=?";args.append(category_name.casefold())
    sql+=" ORDER BY s.featured DESC,s.popular DESC,s.sort_position,s.name LIMIT ?";args.append(limit)
    with connect() as db:return db.execute(sql,args).fetchall()

def quote(service_id,quantity,enforce_limits=True):
    rows=[r for r in service_rows(limit=100000) if r["id"]==int(service_id)]
    if not rows:raise SMMError("SERVICE_UNAVAILABLE")
    r=rows[0]
    if enforce_limits and (quantity<r["minimum"] or quantity>r["maximum"]):raise ValueError(f"Quantity must be {r['minimum']}–{r['maximum']}")
    with connect() as db:
        setting=db.execute("SELECT value FROM smm_settings WHERE key='default_currency'").fetchone()
    selling_currency=(setting[0] if setting else "INR").strip().upper()
    provider_currency=str(r["provider_currency"] or "").strip().upper()
    # An INR provider already returns INR rates. Applying the USD→INR
    # exchange rate again caused the reported 90x overcharge.
    exchange=1.0 if provider_currency==selling_currency else float(r["exchange_rate"])
    cost=float(r["rate"])*quantity/1000*exchange
    percent=float(r["percent_markup"]);fixed=0.0;minprofit=0.0
    if r["custom_markup"]:
        kind,value=r["markup_type"],float(r["markup_value"] or 0)
        if kind=="percentage":percent,fixed=value,0
        elif kind=="fixed":percent,fixed=0,value
        elif kind=="multiplier":percent,fixed=(value-1)*100,0
    # Server 5 pricing is intentionally percentage-only: no fixed add-ons,
    # minimum/maximum profit caps, or rounding surcharges are applied.
    charge=cost*(1+percent/100)
    return Quote(r["id"],r["provider_id"],quantity,round(cost,6),round(charge,6),round(charge-cost,6))

def update_provider_token(provider_id,key,admin_id=None):
    if not str(key or "").strip():raise ValueError("Provider API token is required")
    now=utcnow()
    with transaction(immediate=True) as db:
        changed=db.execute("UPDATE smm_providers SET api_key=?,updated_at=?,last_error=NULL WHERE id=?",("enc:"+encrypt_secret(str(key).strip()),now,int(provider_id))).rowcount
        if not changed:raise SMMError("PROVIDER_NOT_FOUND")
    log("provider_token_updated","API token changed",int(provider_id),admin_id=admin_id)

def delete_service(service_id,admin_id=None):
    now=utcnow()
    with transaction(immediate=True) as db:
        row=db.execute("SELECT provider_id,name FROM smm_services WHERE id=?",(int(service_id),)).fetchone()
        if not row:raise SMMError("SERVICE_UNAVAILABLE")
        db.execute("UPDATE smm_services SET enabled=0,visible=0,deleted_at=? WHERE id=?",(now,int(service_id)))
    log("service_deleted",row["name"],row["provider_id"],admin_id=admin_id)

async def place_order(user_id,username,service_id,quantity,link,request_id=None,discount_percent=0):
    request_id=str(request_id or hashlib.sha256(f"{user_id}|{service_id}|{quantity}|{link}".encode()).hexdigest())[:128]
    lock=_request_lock(request_id)
    async with lock:

        link=html_lib.unescape(str(link or "")).strip()
        anchor=re.search(r'<a\s+[^>]*href=["\']([^"\']+)["\']',link,re.IGNORECASE)
        if anchor:link=anchor.group(1).strip()
        link=re.sub(r'</?a(?:\s+[^>]*)?>','',link,flags=re.IGNORECASE).strip()
        if not link or len(link)>2000:raise SMMError("INVALID_TARGET")
        if int(quantity)<1:raise SMMError("INVALID_QUANTITY")
        q=quote(service_id,int(quantity))
        try:
            discount_percent=max(0.0,min(100.0,float(discount_percent or 0)))
        except (TypeError,ValueError):
            discount_percent=0.0
        if discount_percent:
            discounted_charge=round(max(0.01,q.charge*(100-discount_percent)/100),6)
            q=replace(q,charge=discounted_charge,profit=round(discounted_charge-q.cost,6))
        now=utcnow()
        with transaction(immediate=True) as db:
            existing=db.execute("SELECT id,provider_order_id,status FROM smm_orders WHERE client_request_id=?",(request_id,)).fetchone()
            if existing and existing["provider_order_id"]:return existing["id"],existing["provider_order_id"],q
            r=db.execute("SELECT remote_service_id FROM smm_services WHERE id=? AND enabled=1 AND visible=1 AND deleted_at IS NULL",(service_id,)).fetchone()
            if not r:raise SMMError("SERVICE_UNAVAILABLE")
            changed=db.execute("UPDATE users SET balance=balance-? WHERE user_id=? AND balance>=?",(q.charge,user_id,q.charge)).rowcount
            if not changed:raise SMMError("INSUFFICIENT_BALANCE")
            oid=db.execute("""INSERT INTO smm_orders(user_id,username,service_id,provider_id,quantity,link,charge,provider_cost,profit,status,client_request_id,created_at,updated_at)
              VALUES(?,?,?,?,?,?,?,?,?,'submitting',?,?,?)""",(user_id,username,service_id,q.provider_id,quantity,link,q.charge,q.cost,q.profit,request_id,now,now)).lastrowid
        try:
            provider_order=await Client(q.provider_id).add(r[0],link,int(quantity))
        except Exception as exc:
            detail=getattr(exc,'detail',str(exc))
            with transaction(immediate=True) as db:
                db.execute("UPDATE smm_orders SET status='failed',reason=?,updated_at=? WHERE id=?",(detail,utcnow(),oid))
                db.execute("UPDATE users SET balance=balance+? WHERE user_id=?",(q.charge,user_id))
            log("order_provider_failed",detail,q.provider_id,oid,level="error");raise
        with transaction(immediate=True) as db:
            db.execute("UPDATE smm_orders SET provider_order_id=?,status='pending',updated_at=? WHERE id=?",(provider_order,utcnow(),oid))
            db.execute("UPDATE smm_services SET order_count=order_count+1 WHERE id=?",(service_id,))
        log("order_created",f"user={user_id} charge={q.charge}",q.provider_id,oid);return oid,provider_order,q

def refund_order(order_id,reason="provider_cancelled"):
    with transaction(immediate=True) as db:
        row=db.execute("SELECT user_id,charge,refunded,status FROM smm_orders WHERE id=?",(int(order_id),)).fetchone()
        if not row or row["refunded"]:
            return None
        changed=db.execute("UPDATE smm_orders SET refunded=1,reason=COALESCE(reason,?),updated_at=? WHERE id=? AND refunded=0",(reason,utcnow(),int(order_id))).rowcount
        if not changed:
            return None
        db.execute("UPDATE users SET balance=balance+? WHERE user_id=?",(row["charge"],row["user_id"]))
    log("order_refunded",f"reason={reason} amount={row['charge']}",order_id=int(order_id))
    return {"user_id":row["user_id"],"amount":row["charge"],"reason":reason}

async def refresh_order(order_id):
    with connect() as db:o=db.execute("SELECT * FROM smm_orders WHERE id=?",(order_id,)).fetchone()
    if not o:raise SMMError("ORDER_NOT_FOUND")
    value=await Client(o["provider_id"]).status(o["provider_order_id"])
    mapping={"Pending":"pending","In progress":"processing","Processing":"processing","Completed":"completed","Partial":"partial","Canceled":"cancelled","Cancelled":"cancelled","Cancel":"cancelled","Fail":"failed","Failed":"failed"}
    status=mapping.get(str(value.get("status")),str(value.get("status","pending")).casefold())
    with transaction() as db:db.execute("UPDATE smm_orders SET status=?,start_count=?,remains=?,updated_at=? WHERE id=?",(status,value.get("start_count"),value.get("remains"),utcnow(),order_id))
    refund=None
    if status in ("cancelled","canceled"):
        refund=refund_order(order_id,"provider_cancelled")
    return status,value,refund

async def sync_loop():
    while True:
        with connect() as db:
            interval=int(db.execute("SELECT value FROM smm_settings WHERE key='sync_interval'").fetchone()[0]);ids=[r[0] for r in db.execute("SELECT id FROM smm_providers WHERE enabled=1 AND auto_sync=1 AND deleted_at IS NULL")]
        for pid in ids:
            try:await sync_provider(pid)
            except Exception:pass
        await asyncio.sleep(max(60,interval))

async def order_loop():
    while True:
        with connect() as db:ids=[r[0] for r in db.execute("SELECT id FROM smm_orders WHERE status IN ('pending','processing') LIMIT 100")]
        for oid in ids:
            try:await refresh_order(oid)
            except Exception:pass
        await asyncio.sleep(30)
