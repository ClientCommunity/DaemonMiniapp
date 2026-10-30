"""Catalog constants, country phone codes, and UI icons for DeamonOTPBot."""
from __future__ import annotations

import os

# ================= UI ICONS & COUNTRY CATALOG =================
P_STORE = "<tg-emoji emoji-id='5920332557466997677'>🏪</tg-emoji>"
P_DOC = "<tg-emoji emoji-id='6039630677182254664'>📂</tg-emoji>"
P_ACC = "<tg-emoji emoji-id='5884366771913233289'>👤</tg-emoji>"
P_CART = "🛍️"
P_CASH = "<tg-emoji emoji-id='5904359114531675993'>💰</tg-emoji>"
P_CARD = "💳"
P_FLAG = "<tg-emoji emoji-id='6041923781696426657'>🏳️</tg-emoji>"
P_CAL = "<tg-emoji emoji-id='5891100675042974129'>📅</tg-emoji>"
P_WARN = "⚠️"
P_OFF = "⛔"
P_YES = "<tg-emoji emoji-id='5938252440926163756'>✅</tg-emoji>"
P_NO = "❌"
P_PHONE = "<tg-emoji emoji-id='6039605143601680423'>📞</tg-emoji>"
P_TIME = "<tg-emoji emoji-id='5983150113483134607'>⏰️</tg-emoji>"
P_GIFT = "<tg-emoji emoji-id='6032644646587338669'>🎁</tg-emoji>"
P_SHIELD = "<tg-emoji emoji-id='6030537007350944596'>🛡</tg-emoji>"
P_BANK = "🏦"
P_ID = "🆔"
P_TADA = "<tg-emoji emoji-id='6041731551845159060'>🎉</tg-emoji>"
P_INR = "₹"
P_SHOP = "<tg-emoji emoji-id='5920332557466997677'>🏪</tg-emoji>"
P_HELP = "<tg-emoji emoji-id='6035305550625902723'>💬</tg-emoji>"

# Country name -> (ISO-2 code, flag). Keep names stable because they are used in
# callback payloads, markup settings, and cache keys.
COUNTRY_CODES = {
    "Argentina": ("AR", "🇦🇷"), "Australia": ("AU", "🇦🇺"), "Austria": ("AT", "🇦🇹"),
    "Bangladesh": ("BD", "🇧🇩"), "Belgium": ("BE", "🇧🇪"), "Brazil": ("BR", "🇧🇷"),
    "Canada": ("CA", "🇨🇦"), "Chile": ("CL", "🇨🇱"), "China": ("CN", "🇨🇳"),
    "Colombia": ("CO", "🇨🇴"), "Egypt": ("EG", "🇪🇬"), "France": ("FR", "🇫🇷"),
    "Germany": ("DE", "🇩🇪"), "Hong Kong": ("HK", "🇭🇰"), "India": ("IN", "🇮🇳"),
    "Indonesia": ("ID", "🇮🇩"), "Iran": ("IR", "🇮🇷"), "Iraq": ("IQ", "🇮🇶"),
    "Italy": ("IT", "🇮🇹"), "Japan": ("JP", "🇯🇵"), "Kazakhstan": ("KZ", "🇰🇿"),
    "Kenya": ("KE", "🇰🇪"), "Malaysia": ("MY", "🇲🇾"), "Mexico": ("MX", "🇲🇽"),
    "Morocco": ("MA", "🇲🇦"), "Nepal": ("NP", "🇳🇵"), "Netherlands": ("NL", "🇳🇱"),
    "Nigeria": ("NG", "🇳🇬"), "Pakistan": ("PK", "🇵🇰"), "Peru": ("PE", "🇵🇪"),
    "Philippines": ("PH", "🇵🇭"), "Poland": ("PL", "🇵🇱"), "Portugal": ("PT", "🇵🇹"),
    "Romania": ("RO", "🇷🇴"), "Russia": ("RU", "🇷🇺"), "Saudi Arabia": ("SA", "🇸🇦"),
    "Singapore": ("SG", "🇸🇬"), "South Africa": ("ZA", "🇿🇦"), "South Korea": ("KR", "🇰🇷"),
    "Spain": ("ES", "🇪🇸"), "Sri Lanka": ("LK", "🇱🇰"), "Thailand": ("TH", "🇹🇭"),
    "Turkey": ("TR", "🇹🇷"), "Ukraine": ("UA", "🇺🇦"), "United Arab Emirates": ("AE", "🇦🇪"),
    "United Kingdom": ("GB", "🇬🇧"), "United States": ("US", "🇺🇸"), "Uzbekistan": ("UZ", "🇺🇿"),
    "Vietnam": ("VN", "🇻🇳"),
}

CALLING_CODES = {
    "Argentina": "54", "Australia": "61", "Austria": "43", "Bangladesh": "880", "Belgium": "32",
    "Brazil": "55", "Canada": "1", "Chile": "56", "China": "86", "Colombia": "57", "Egypt": "20",
    "France": "33", "Germany": "49", "Hong Kong": "852", "India": "91", "Indonesia": "62",
    "Iran": "98", "Iraq": "964", "Italy": "39", "Japan": "81", "Kazakhstan": "7", "Kenya": "254",
    "Malaysia": "60", "Mexico": "52", "Morocco": "212", "Nepal": "977", "Netherlands": "31",
    "Nigeria": "234", "Pakistan": "92", "Peru": "51", "Philippines": "63", "Poland": "48",
    "Portugal": "351", "Romania": "40", "Russia": "7", "Saudi Arabia": "966", "Singapore": "65",
    "South Africa": "27", "South Korea": "82", "Spain": "34", "Sri Lanka": "94", "Thailand": "66",
    "Turkey": "90", "Ukraine": "380", "United Arab Emirates": "971", "United Kingdom": "44",
    "United States": "1", "Uzbekistan": "998", "Vietnam": "84",
}

ADDITIONAL_COUNTRY_DATA = {
    "Afghanistan": ("AF", "🇦🇫", "93"), "Albania": ("AL", "🇦🇱", "355"),
    "Algeria": ("DZ", "🇩🇿", "213"), "Angola": ("AO", "🇦🇴", "244"),
    "Armenia": ("AM", "🇦🇲", "374"), "Azerbaijan": ("AZ", "🇦🇿", "994"),
    "Bahamas": ("BS", "🇧🇸", "1"), "Bahrain": ("BH", "🇧🇭", "973"),
    "Belize": ("BZ", "🇧🇿", "501"), "Botswana": ("BW", "🇧🇼", "267"),
    "Cape Verde": ("CV", "🇨🇻", "238"), "Central African Republic": ("CF", "🇨🇫", "236"),
    "Chad": ("TD", "🇹🇩", "235"), "Comoros": ("KM", "🇰🇲", "269"),
    "Congo": ("CG", "🇨🇬", "242"), "Costa Rica": ("CR", "🇨🇷", "506"),
    "Cuba": ("CU", "🇨🇺", "53"), "Czech Republic": ("CZ", "🇨🇿", "420"),
    "Denmark": ("DK", "🇩🇰", "45"), "Djibouti": ("DJ", "🇩🇯", "253"),
    "Dominica": ("DM", "🇩🇲", "1"), "Dominican Republic": ("DO", "🇩🇴", "1"),
    "Ecuador": ("EC", "🇪🇨", "593"), "El Salvador": ("SV", "🇸🇻", "503"),
    "Estonia": ("EE", "🇪🇪", "372"), "Fiji": ("FJ", "🇫🇯", "679"),
    "Finland": ("FI", "🇫🇮", "358"), "Gabon": ("GA", "🇬🇦", "241"),
    "Georgia": ("GE", "🇬🇪", "995"), "Ghana": ("GH", "🇬🇭", "233"),
    "Greece": ("GR", "🇬🇷", "30"), "Greenland": ("GL", "🇬🇱", "299"),
    "Grenada": ("GD", "🇬🇩", "1"), "Guadeloupe": ("GP", "🇬🇵", "590"),
    "Guam": ("GU", "🇬🇺", "1"), "Guatemala": ("GT", "🇬🇹", "502"),
    "Guyana": ("GY", "🇬🇾", "592"), "Haiti": ("HT", "🇭🇹", "509"),
    "Honduras": ("HN", "🇭🇳", "504"), "Hungary": ("HU", "🇭🇺", "36"),
    "Iceland": ("IS", "🇮🇸", "354"), "Ireland": ("IE", "🇮🇪", "353"),
    "Israel": ("IL", "🇮🇱", "972"), "Ivory Coast": ("CI", "🇨🇮", "225"),
    "Jamaica": ("JM", "🇯🇲", "1"), "Jordan": ("JO", "🇯🇴", "962"),
    "Kiribati": ("KI", "🇰🇮", "686"), "Kuwait": ("KW", "🇰🇼", "965"),
    "Kyrgyzstan": ("KG", "🇰🇬", "996"), "Laos": ("LA", "🇱🇦", "856"),
    "Latvia": ("LV", "🇱🇻", "371"), "Lebanon": ("LB", "🇱🇧", "961"),
    "Lesotho": ("LS", "🇱🇸", "266"), "Libya": ("LY", "🇱🇾", "218"),
    "Lithuania": ("LT", "🇱🇹", "370"), "Luxembourg": ("LU", "🇱🇺", "352"),
    "Macau": ("MO", "🇲🇴", "853"), "Madagascar": ("MG", "🇲🇬", "261"),
    "Malawi": ("MW", "🇲🇼", "265"), "Maldives": ("MV", "🇲🇻", "960"),
    "Malta": ("MT", "🇲🇹", "356"), "Mauritania": ("MR", "🇲🇷", "222"),
    "Mauritius": ("MU", "🇲🇺", "230"), "Moldova": ("MD", "🇲🇩", "373"),
    "Mozambique": ("MZ", "🇲🇿", "258"), "Myanmar": ("MM", "🇲🇲", "95"),
    "New Zealand": ("NZ", "🇳🇿", "64"), "Nicaragua": ("NI", "🇳🇮", "505"),
    "Niger": ("NE", "🇳🇪", "227"), "Norway": ("NO", "🇳🇴", "47"),
    "Oman": ("OM", "🇴🇲", "968"), "Palau": ("PW", "🇵🇼", "680"),
    "Palestine": ("PS", "🇵🇸", "970"), "Panama": ("PA", "🇵🇦", "507"),
    "Papua New Guinea": ("PG", "🇵🇬", "675"), "Paraguay": ("PY", "🇵🇾", "595"),
    "Puerto Rico": ("PR", "🇵🇷", "1787"), "Qatar": ("QA", "🇶🇦", "974"),
    "Samoa": ("WS", "🇼🇸", "685"), "Senegal": ("SN", "🇸🇳", "221"),
    "Serbia": ("RS", "🇷🇸", "381"), "Seychelles": ("SC", "🇸🇨", "248"),
    "Sierra Leone": ("SL", "🇸🇱", "232"), "Slovenia": ("SI", "🇸🇮", "386"),
    "Solomon Islands": ("SB", "🇸🇧", "677"), "Somalia": ("SO", "🇸🇴", "252"),
    "South Sudan": ("SS", "🇸🇸", "211"), "Sudan": ("SD", "🇸🇩", "249"),
    "Suriname": ("SR", "🇸🇷", "597"), "Swaziland": ("SZ", "🇸🇿", "268"),
    "Sweden": ("SE", "🇸🇪", "46"), "Switzerland": ("CH", "🇨🇭", "41"),
    "Syria": ("SY", "🇸🇾", "963"), "Taiwan": ("TW", "🇹🇼", "886"),
    "Tajikistan": ("TJ", "🇹🇯", "992"), "Timor-Leste": ("TL", "🇹🇱", "670"),
    "Togo": ("TG", "🇹🇬", "228"), "Tonga": ("TO", "🇹🇴", "676"),
    "Trinidad and Tobago": ("TT", "🇹🇹", "1"), "Tunisia": ("TN", "🇹🇳", "216"),
    "Turkmenistan": ("TM", "🇹🇲", "993"), "Uganda": ("UG", "🇺🇬", "256"),
    "Uruguay": ("UY", "🇺🇾", "598"), "Vanuatu": ("VU", "🇻🇺", "678"),
    "Yemen": ("YE", "🇾🇪", "967"), "Zambia": ("ZM", "🇿🇲", "260"),
}
for _country_name, (_iso, _flag, _calling) in ADDITIONAL_COUNTRY_DATA.items():
    COUNTRY_CODES.setdefault(_country_name, (_iso, _flag))
    CALLING_CODES.setdefault(_country_name, _calling)

# Extra Server 1 country catalog entries. The third value is a stable button/API
# code used by callbacks; if the market rejects it, lookups fall back to the
# country name automatically.
MORE_SERVER1_COUNTRIES = """
Åland Islands|ALA|🇦🇽|358
American Samoa|ASM|🇦🇸|1
Andorra|AND|🇦🇩|376
Anguilla|AIA|🇦🇮|1
Antarctica|ATA|🇦🇶|672
Antigua and Barbuda|ATG|🇦🇬|1
Aruba|ABW|🇦🇼|297
Bahamas|BHS|🇧🇸|1
Barbados|BRB|🇧🇧|1
Belarus|BLR|🇧🇾|375
Benin|BEN|🇧🇯|229
Bermuda|BMU|🇧🇲|1
Bhutan|BTN|🇧🇹|975
Bolivia|BOL|🇧🇴|591
Bosnia and Herzegovina|BIH|🇧🇦|387
Bouvet Island|BVT|🇧🇻|47
British Indian Ocean Territory|IOT|🇮🇴|246
British Virgin Islands|VGB|🇻🇬|1
Brunei|BRN|🇧🇳|673
Bulgaria|BGR|🇧🇬|359
Burkina Faso|BFA|🇧🇫|226
Burundi|BDI|🇧🇮|257
Cambodia|KHM|🇰🇭|855
Cameroon|CMR|🇨🇲|237
Canary Islands|CNR|🇮🇨|34
Caribbean Netherlands|BES|🇧🇶|599
Cayman Islands|CYM|🇰🇾|1
Congo (DRC)|COD|🇨🇩|243
Cook Islands|COK|🇨🇰|682
Côte d’Ivoire|CIV|🇨🇮|225
Croatia|HRV|🇭🇷|385
Curaçao|CUW|🇨🇼|599
Cyprus|CYP|🇨🇾|357
Czechia|CZE|🇨🇿|420
Equatorial Guinea|GNQ|🇬🇶|240
Eritrea|ERI|🇪🇷|291
Eswatini|SWZ|🇸🇿|268
Ethiopia|ETH|🇪🇹|251
Falkland Islands|FLK|🇫🇰|500
Faroe Islands|FRO|🇫🇴|298
French Guiana|GUF|🇬🇫|594
French Polynesia|PYF|🇵🇫|689
French Southern Territories|ATF|🇹🇫|262
Gambia|GMB|🇬🇲|220
Gibraltar|GIB|🇬🇮|350
Guernsey|GGY|🇬🇬|44
Guinea|GIN|🇬🇳|224
Guinea-Bissau|GNB|🇬🇼|245
Heard Island and McDonald Islands|HMD|🇭🇲|672
Isle of Man|IMN|🇮🇲|44
Jersey|JEY|🇯🇪|44
Kosovo|XKX|🇽🇰|383
Liberia|LBR|🇱🇷|231
Liechtenstein|LIE|🇱🇮|423
Mali|MLI|🇲🇱|223
Marshall Islands|MHL|🇲🇭|692
Martinique|MTQ|🇲🇶|596
Mayotte|MYT|🇾🇹|262
Micronesia|FSM|🇫🇲|691
Monaco|MCO|🇲🇨|377
Mongolia|MNG|🇲🇳|976
Montenegro|MNE|🇲🇪|382
Montserrat|MSR|🇲🇸|1
Namibia|NAM|🇳🇦|264
Nauru|NRU|🇳🇷|674
New Caledonia|NCL|🇳🇨|687
Niue|NIU|🇳🇺|683
Norfolk Island|NFK|🇳🇫|672
North Korea|PRK|🇰🇵|850
North Macedonia|MKD|🇲🇰|389
Northern Mariana Islands|MNP|🇲🇵|1
Pitcairn Islands|PCN|🇵🇳|64
Réunion|REU|🇷🇪|262
Rwanda|RWA|🇷🇼|250
Saint Barthélemy|BLM|🇧🇱|590
Saint Helena|SHN|🇸🇭|290
Saint Kitts and Nevis|KNA|🇰🇳|1
Saint Lucia|LCA|🇱🇨|1
Saint Martin|MAF|🇲🇫|590
Saint Pierre and Miquelon|SPM|🇵🇲|508
Saint Vincent and the Grenadines|VCT|🇻🇨|1
San Marino|SMR|🇸🇲|378
São Tomé and Príncipe|STP|🇸🇹|239
Sint Maarten|SXM|🇸🇽|1
Slovakia|SVK|🇸🇰|421
South Georgia and South Sandwich Islands|SGS|🇬🇸|500
Svalbard and Jan Mayen|SJM|🇸🇯|47
Tanzania|TZA|🇹🇿|255
Tokelau|TKL|🇹🇰|690
Turks and Caicos Islands|TCA|🇹🇨|1
Tuvalu|TUV|🇹🇻|688
Vatican City|VAT|🇻🇦|379
Venezuela|VEN|🇻🇪|58
U.S. Virgin Islands|VIR|🇻🇮|1
Wallis and Futuna|WLF|🇼🇫|681
Western Sahara|ESH|🇪🇭|212
Zimbabwe|ZWE|🇿🇼|263
"""
for _line in MORE_SERVER1_COUNTRIES.strip().splitlines():
    _name, _code, _flag, _calling = _line.split("|")
    COUNTRY_CODES.setdefault(_name, (_code, _flag))
    CALLING_CODES.setdefault(_name, _calling)


class ConversationCancelled(Exception):
    pass


PREMIUM_EMOJI_IDS = {
    "verified": os.getenv("PREMIUM_EMOJI_VERIFIED", "").strip(),
    "timer": os.getenv("PREMIUM_EMOJI_TIMER", "").strip(),
    "money": os.getenv("PREMIUM_EMOJI_MONEY", "").strip(),
    "shield": os.getenv("PREMIUM_EMOJI_SHIELD", "").strip(),
    "bot": os.getenv("PREMIUM_EMOJI_BOT", "").strip(),
    "zap": os.getenv("PREMIUM_EMOJI_ZAP", "").strip(),
    "fire": os.getenv("PREMIUM_EMOJI_FIRE", "").strip(),
    "star": os.getenv("PREMIUM_EMOJI_STAR", "").strip(),
    "check": os.getenv("PREMIUM_EMOJI_CHECK", "").strip(),
    "cross": os.getenv("PREMIUM_EMOJI_CROSS", "").strip(),
    "globe": os.getenv("PREMIUM_EMOJI_GLOBE", "").strip(),
    "gear": os.getenv("PREMIUM_EMOJI_GEAR", "").strip(),
    "key": os.getenv("PREMIUM_EMOJI_KEY", "").strip(),
    "user": os.getenv("PREMIUM_EMOJI_USER", "").strip(),
    "sparkles": os.getenv("PREMIUM_EMOJI_SPARKLES", "").strip(),
    "sales": os.getenv("PREMIUM_EMOJI_SALES", "").strip(),
    "admin": os.getenv("PREMIUM_EMOJI_ADMIN", "").strip(),
}

OTP_REGEX = r'\b\d{5}\b'
LZT_PRICE_CURRENCY = os.getenv("LZT_PRICE_CURRENCY", "rub").strip().lower() or "rub"
UPI_MID = os.getenv("UPI_MID", "hAsqwQ85709194299740").strip()
AUTO_CANCEL_SECONDS = int(os.getenv("AUTO_CANCEL_SECONDS", "600"))

