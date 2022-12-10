import * as Commander from 'commander';
import { program } from 'commander';
import log from 'loglevel';
import url, { fileURLToPath } from 'url';
import isurl from 'is-url';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { dir } from 'tmp-promise';
import chalk from 'chalk';
import ora from 'ora';
import shelljs from 'shelljs';
import updateNotifier from 'update-notifier';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

const DEFAULT_PAKE_OPTIONS = {
    icon: '',
    height: 800,
    width: 1280,
    fullscreen: false,
    resizable: true,
    transparent: false,
    debug: false,
};

const tlds = [
    "aaa",
    "aarp",
    "abarth",
    "abb",
    "abbott",
    "abbvie",
    "abc",
    "able",
    "abogado",
    "abudhabi",
    "ac",
    "academy",
    "accenture",
    "accountant",
    "accountants",
    "aco",
    "actor",
    "ad",
    "adac",
    "ads",
    "adult",
    "ae",
    "aeg",
    "aero",
    "aetna",
    "af",
    "afl",
    "africa",
    "ag",
    "agakhan",
    "agency",
    "ai",
    "aig",
    "airbus",
    "airforce",
    "airtel",
    "akdn",
    "al",
    "alfaromeo",
    "alibaba",
    "alipay",
    "allfinanz",
    "allstate",
    "ally",
    "alsace",
    "alstom",
    "am",
    "amazon",
    "americanexpress",
    "americanfamily",
    "amex",
    "amfam",
    "amica",
    "amsterdam",
    "analytics",
    "android",
    "anquan",
    "anz",
    "ao",
    "aol",
    "apartments",
    "app",
    "apple",
    "aq",
    "aquarelle",
    "ar",
    "arab",
    "aramco",
    "archi",
    "army",
    "arpa",
    "art",
    "arte",
    "as",
    "asda",
    "asia",
    "associates",
    "at",
    "athleta",
    "attorney",
    "au",
    "auction",
    "audi",
    "audible",
    "audio",
    "auspost",
    "author",
    "auto",
    "autos",
    "avianca",
    "aw",
    "aws",
    "ax",
    "axa",
    "az",
    "azure",
    "ba",
    "baby",
    "baidu",
    "banamex",
    "bananarepublic",
    "band",
    "bank",
    "bar",
    "barcelona",
    "barclaycard",
    "barclays",
    "barefoot",
    "bargains",
    "baseball",
    "basketball",
    "bauhaus",
    "bayern",
    "bb",
    "bbc",
    "bbt",
    "bbva",
    "bcg",
    "bcn",
    "bd",
    "be",
    "beats",
    "beauty",
    "beer",
    "bentley",
    "berlin",
    "best",
    "bestbuy",
    "bet",
    "bf",
    "bg",
    "bh",
    "bharti",
    "bi",
    "bible",
    "bid",
    "bike",
    "bing",
    "bingo",
    "bio",
    "biz",
    "bj",
    "black",
    "blackfriday",
    "blockbuster",
    "blog",
    "bloomberg",
    "blue",
    "bm",
    "bms",
    "bmw",
    "bn",
    "bnpparibas",
    "bo",
    "boats",
    "boehringer",
    "bofa",
    "bom",
    "bond",
    "boo",
    "book",
    "booking",
    "bosch",
    "bostik",
    "boston",
    "bot",
    "boutique",
    "box",
    "br",
    "bradesco",
    "bridgestone",
    "broadway",
    "broker",
    "brother",
    "brussels",
    "bs",
    "bt",
    "build",
    "builders",
    "business",
    "buy",
    "buzz",
    "bv",
    "bw",
    "by",
    "bz",
    "bzh",
    "ca",
    "cab",
    "cafe",
    "cal",
    "call",
    "calvinklein",
    "cam",
    "camera",
    "camp",
    "canon",
    "capetown",
    "capital",
    "capitalone",
    "car",
    "caravan",
    "cards",
    "care",
    "career",
    "careers",
    "cars",
    "casa",
    "case",
    "cash",
    "casino",
    "cat",
    "catering",
    "catholic",
    "cba",
    "cbn",
    "cbre",
    "cbs",
    "cc",
    "cd",
    "center",
    "ceo",
    "cern",
    "cf",
    "cfa",
    "cfd",
    "cg",
    "ch",
    "chanel",
    "channel",
    "charity",
    "chase",
    "chat",
    "cheap",
    "chintai",
    "christmas",
    "chrome",
    "church",
    "ci",
    "cipriani",
    "circle",
    "cisco",
    "citadel",
    "citi",
    "citic",
    "city",
    "cityeats",
    "ck",
    "cl",
    "claims",
    "cleaning",
    "click",
    "clinic",
    "clinique",
    "clothing",
    "cloud",
    "club",
    "clubmed",
    "cm",
    "cn",
    "co",
    "coach",
    "codes",
    "coffee",
    "college",
    "cologne",
    "com",
    "comcast",
    "commbank",
    "community",
    "company",
    "compare",
    "computer",
    "comsec",
    "condos",
    "construction",
    "consulting",
    "contact",
    "contractors",
    "cooking",
    "cookingchannel",
    "cool",
    "coop",
    "corsica",
    "country",
    "coupon",
    "coupons",
    "courses",
    "cpa",
    "cr",
    "credit",
    "creditcard",
    "creditunion",
    "cricket",
    "crown",
    "crs",
    "cruise",
    "cruises",
    "cu",
    "cuisinella",
    "cv",
    "cw",
    "cx",
    "cy",
    "cymru",
    "cyou",
    "cz",
    "dabur",
    "dad",
    "dance",
    "data",
    "date",
    "dating",
    "datsun",
    "day",
    "dclk",
    "dds",
    "de",
    "deal",
    "dealer",
    "deals",
    "degree",
    "delivery",
    "dell",
    "deloitte",
    "delta",
    "democrat",
    "dental",
    "dentist",
    "desi",
    "design",
    "dev",
    "dhl",
    "diamonds",
    "diet",
    "digital",
    "direct",
    "directory",
    "discount",
    "discover",
    "dish",
    "diy",
    "dj",
    "dk",
    "dm",
    "dnp",
    "do",
    "docs",
    "doctor",
    "dog",
    "domains",
    "dot",
    "download",
    "drive",
    "dtv",
    "dubai",
    "dunlop",
    "dupont",
    "durban",
    "dvag",
    "dvr",
    "dz",
    "earth",
    "eat",
    "ec",
    "eco",
    "edeka",
    "edu",
    "education",
    "ee",
    "eg",
    "email",
    "emerck",
    "energy",
    "engineer",
    "engineering",
    "enterprises",
    "epson",
    "equipment",
    "er",
    "ericsson",
    "erni",
    "es",
    "esq",
    "estate",
    "et",
    "etisalat",
    "eu",
    "eurovision",
    "eus",
    "events",
    "exchange",
    "expert",
    "exposed",
    "express",
    "extraspace",
    "fage",
    "fail",
    "fairwinds",
    "faith",
    "family",
    "fan",
    "fans",
    "farm",
    "farmers",
    "fashion",
    "fast",
    "fedex",
    "feedback",
    "ferrari",
    "ferrero",
    "fi",
    "fiat",
    "fidelity",
    "fido",
    "film",
    "final",
    "finance",
    "financial",
    "fire",
    "firestone",
    "firmdale",
    "fish",
    "fishing",
    "fit",
    "fitness",
    "fj",
    "fk",
    "flickr",
    "flights",
    "flir",
    "florist",
    "flowers",
    "fly",
    "fm",
    "fo",
    "foo",
    "food",
    "foodnetwork",
    "football",
    "ford",
    "forex",
    "forsale",
    "forum",
    "foundation",
    "fox",
    "fr",
    "free",
    "fresenius",
    "frl",
    "frogans",
    "frontdoor",
    "frontier",
    "ftr",
    "fujitsu",
    "fun",
    "fund",
    "furniture",
    "futbol",
    "fyi",
    "ga",
    "gal",
    "gallery",
    "gallo",
    "gallup",
    "game",
    "games",
    "gap",
    "garden",
    "gay",
    "gb",
    "gbiz",
    "gd",
    "gdn",
    "ge",
    "gea",
    "gent",
    "genting",
    "george",
    "gf",
    "gg",
    "ggee",
    "gh",
    "gi",
    "gift",
    "gifts",
    "gives",
    "giving",
    "gl",
    "glass",
    "gle",
    "global",
    "globo",
    "gm",
    "gmail",
    "gmbh",
    "gmo",
    "gmx",
    "gn",
    "godaddy",
    "gold",
    "goldpoint",
    "golf",
    "goo",
    "goodyear",
    "goog",
    "google",
    "gop",
    "got",
    "gov",
    "gp",
    "gq",
    "gr",
    "grainger",
    "graphics",
    "gratis",
    "green",
    "gripe",
    "grocery",
    "group",
    "gs",
    "gt",
    "gu",
    "guardian",
    "gucci",
    "guge",
    "guide",
    "guitars",
    "guru",
    "gw",
    "gy",
    "hair",
    "hamburg",
    "hangout",
    "haus",
    "hbo",
    "hdfc",
    "hdfcbank",
    "health",
    "healthcare",
    "help",
    "helsinki",
    "here",
    "hermes",
    "hgtv",
    "hiphop",
    "hisamitsu",
    "hitachi",
    "hiv",
    "hk",
    "hkt",
    "hm",
    "hn",
    "hockey",
    "holdings",
    "holiday",
    "homedepot",
    "homegoods",
    "homes",
    "homesense",
    "honda",
    "horse",
    "hospital",
    "host",
    "hosting",
    "hot",
    "hoteles",
    "hotels",
    "hotmail",
    "house",
    "how",
    "hr",
    "hsbc",
    "ht",
    "hu",
    "hughes",
    "hyatt",
    "hyundai",
    "ibm",
    "icbc",
    "ice",
    "icu",
    "id",
    "ie",
    "ieee",
    "ifm",
    "ikano",
    "il",
    "im",
    "imamat",
    "imdb",
    "immo",
    "immobilien",
    "in",
    "inc",
    "industries",
    "infiniti",
    "info",
    "ing",
    "ink",
    "institute",
    "insurance",
    "insure",
    "int",
    "international",
    "intuit",
    "investments",
    "io",
    "ipiranga",
    "iq",
    "ir",
    "irish",
    "is",
    "ismaili",
    "ist",
    "istanbul",
    "it",
    "itau",
    "itv",
    "jaguar",
    "java",
    "jcb",
    "je",
    "jeep",
    "jetzt",
    "jewelry",
    "jio",
    "jll",
    "jm",
    "jmp",
    "jnj",
    "jo",
    "jobs",
    "joburg",
    "jot",
    "joy",
    "jp",
    "jpmorgan",
    "jprs",
    "juegos",
    "juniper",
    "kaufen",
    "kddi",
    "ke",
    "kerryhotels",
    "kerrylogistics",
    "kerryproperties",
    "kfh",
    "kg",
    "kh",
    "ki",
    "kia",
    "kids",
    "kim",
    "kinder",
    "kindle",
    "kitchen",
    "kiwi",
    "km",
    "kn",
    "koeln",
    "komatsu",
    "kosher",
    "kp",
    "kpmg",
    "kpn",
    "kr",
    "krd",
    "kred",
    "kuokgroup",
    "kw",
    "ky",
    "kyoto",
    "kz",
    "la",
    "lacaixa",
    "lamborghini",
    "lamer",
    "lancaster",
    "lancia",
    "land",
    "landrover",
    "lanxess",
    "lasalle",
    "lat",
    "latino",
    "latrobe",
    "law",
    "lawyer",
    "lb",
    "lc",
    "lds",
    "lease",
    "leclerc",
    "lefrak",
    "legal",
    "lego",
    "lexus",
    "lgbt",
    "li",
    "lidl",
    "life",
    "lifeinsurance",
    "lifestyle",
    "lighting",
    "like",
    "lilly",
    "limited",
    "limo",
    "lincoln",
    "linde",
    "link",
    "lipsy",
    "live",
    "living",
    "lk",
    "llc",
    "llp",
    "loan",
    "loans",
    "locker",
    "locus",
    "loft",
    "lol",
    "london",
    "lotte",
    "lotto",
    "love",
    "lpl",
    "lplfinancial",
    "lr",
    "ls",
    "lt",
    "ltd",
    "ltda",
    "lu",
    "lundbeck",
    "luxe",
    "luxury",
    "lv",
    "ly",
    "ma",
    "macys",
    "madrid",
    "maif",
    "maison",
    "makeup",
    "man",
    "management",
    "mango",
    "map",
    "market",
    "marketing",
    "markets",
    "marriott",
    "marshalls",
    "maserati",
    "mattel",
    "mba",
    "mc",
    "mckinsey",
    "md",
    "me",
    "med",
    "media",
    "meet",
    "melbourne",
    "meme",
    "memorial",
    "men",
    "menu",
    "merckmsd",
    "mg",
    "mh",
    "miami",
    "microsoft",
    "mil",
    "mini",
    "mint",
    "mit",
    "mitsubishi",
    "mk",
    "ml",
    "mlb",
    "mls",
    "mm",
    "mma",
    "mn",
    "mo",
    "mobi",
    "mobile",
    "moda",
    "moe",
    "moi",
    "mom",
    "monash",
    "money",
    "monster",
    "mormon",
    "mortgage",
    "moscow",
    "moto",
    "motorcycles",
    "mov",
    "movie",
    "mp",
    "mq",
    "mr",
    "ms",
    "msd",
    "mt",
    "mtn",
    "mtr",
    "mu",
    "museum",
    "music",
    "mutual",
    "mv",
    "mw",
    "mx",
    "my",
    "mz",
    "na",
    "nab",
    "nagoya",
    "name",
    "natura",
    "navy",
    "nba",
    "nc",
    "ne",
    "nec",
    "net",
    "netbank",
    "netflix",
    "network",
    "neustar",
    "new",
    "news",
    "next",
    "nextdirect",
    "nexus",
    "nf",
    "nfl",
    "ng",
    "ngo",
    "nhk",
    "ni",
    "nico",
    "nike",
    "nikon",
    "ninja",
    "nissan",
    "nissay",
    "nl",
    "no",
    "nokia",
    "northwesternmutual",
    "norton",
    "now",
    "nowruz",
    "nowtv",
    "np",
    "nr",
    "nra",
    "nrw",
    "ntt",
    "nu",
    "nyc",
    "nz",
    "obi",
    "observer",
    "office",
    "okinawa",
    "olayan",
    "olayangroup",
    "oldnavy",
    "ollo",
    "om",
    "omega",
    "one",
    "ong",
    "onl",
    "online",
    "ooo",
    "open",
    "oracle",
    "orange",
    "org",
    "organic",
    "origins",
    "osaka",
    "otsuka",
    "ott",
    "ovh",
    "pa",
    "page",
    "panasonic",
    "paris",
    "pars",
    "partners",
    "parts",
    "party",
    "passagens",
    "pay",
    "pccw",
    "pe",
    "pet",
    "pf",
    "pfizer",
    "pg",
    "ph",
    "pharmacy",
    "phd",
    "philips",
    "phone",
    "photo",
    "photography",
    "photos",
    "physio",
    "pics",
    "pictet",
    "pictures",
    "pid",
    "pin",
    "ping",
    "pink",
    "pioneer",
    "pizza",
    "pk",
    "pl",
    "place",
    "play",
    "playstation",
    "plumbing",
    "plus",
    "pm",
    "pn",
    "pnc",
    "pohl",
    "poker",
    "politie",
    "porn",
    "post",
    "pr",
    "pramerica",
    "praxi",
    "press",
    "prime",
    "pro",
    "prod",
    "productions",
    "prof",
    "progressive",
    "promo",
    "properties",
    "property",
    "protection",
    "pru",
    "prudential",
    "ps",
    "pt",
    "pub",
    "pw",
    "pwc",
    "py",
    "qa",
    "qpon",
    "quebec",
    "quest",
    "racing",
    "radio",
    "re",
    "read",
    "realestate",
    "realtor",
    "realty",
    "recipes",
    "red",
    "redstone",
    "redumbrella",
    "rehab",
    "reise",
    "reisen",
    "reit",
    "reliance",
    "ren",
    "rent",
    "rentals",
    "repair",
    "report",
    "republican",
    "rest",
    "restaurant",
    "review",
    "reviews",
    "rexroth",
    "rich",
    "richardli",
    "ricoh",
    "ril",
    "rio",
    "rip",
    "ro",
    "rocher",
    "rocks",
    "rodeo",
    "rogers",
    "room",
    "rs",
    "rsvp",
    "ru",
    "rugby",
    "ruhr",
    "run",
    "rw",
    "rwe",
    "ryukyu",
    "sa",
    "saarland",
    "safe",
    "safety",
    "sakura",
    "sale",
    "salon",
    "samsclub",
    "samsung",
    "sandvik",
    "sandvikcoromant",
    "sanofi",
    "sap",
    "sarl",
    "sas",
    "save",
    "saxo",
    "sb",
    "sbi",
    "sbs",
    "sc",
    "sca",
    "scb",
    "schaeffler",
    "schmidt",
    "scholarships",
    "school",
    "schule",
    "schwarz",
    "science",
    "scot",
    "sd",
    "se",
    "search",
    "seat",
    "secure",
    "security",
    "seek",
    "select",
    "sener",
    "services",
    "ses",
    "seven",
    "sew",
    "sex",
    "sexy",
    "sfr",
    "sg",
    "sh",
    "shangrila",
    "sharp",
    "shaw",
    "shell",
    "shia",
    "shiksha",
    "shoes",
    "shop",
    "shopping",
    "shouji",
    "show",
    "showtime",
    "si",
    "silk",
    "sina",
    "singles",
    "site",
    "sj",
    "sk",
    "ski",
    "skin",
    "sky",
    "skype",
    "sl",
    "sling",
    "sm",
    "smart",
    "smile",
    "sn",
    "sncf",
    "so",
    "soccer",
    "social",
    "softbank",
    "software",
    "sohu",
    "solar",
    "solutions",
    "song",
    "sony",
    "soy",
    "spa",
    "space",
    "sport",
    "spot",
    "sr",
    "srl",
    "ss",
    "st",
    "stada",
    "staples",
    "star",
    "statebank",
    "statefarm",
    "stc",
    "stcgroup",
    "stockholm",
    "storage",
    "store",
    "stream",
    "studio",
    "study",
    "style",
    "su",
    "sucks",
    "supplies",
    "supply",
    "support",
    "surf",
    "surgery",
    "suzuki",
    "sv",
    "swatch",
    "swiss",
    "sx",
    "sy",
    "sydney",
    "systems",
    "sz",
    "tab",
    "taipei",
    "talk",
    "taobao",
    "target",
    "tatamotors",
    "tatar",
    "tattoo",
    "tax",
    "taxi",
    "tc",
    "tci",
    "td",
    "tdk",
    "team",
    "tech",
    "technology",
    "tel",
    "temasek",
    "tennis",
    "teva",
    "tf",
    "tg",
    "th",
    "thd",
    "theater",
    "theatre",
    "tiaa",
    "tickets",
    "tienda",
    "tiffany",
    "tips",
    "tires",
    "tirol",
    "tj",
    "tjmaxx",
    "tjx",
    "tk",
    "tkmaxx",
    "tl",
    "tm",
    "tmall",
    "tn",
    "to",
    "today",
    "tokyo",
    "tools",
    "top",
    "toray",
    "toshiba",
    "total",
    "tours",
    "town",
    "toyota",
    "toys",
    "tr",
    "trade",
    "trading",
    "training",
    "travel",
    "travelchannel",
    "travelers",
    "travelersinsurance",
    "trust",
    "trv",
    "tt",
    "tube",
    "tui",
    "tunes",
    "tushu",
    "tv",
    "tvs",
    "tw",
    "tz",
    "ua",
    "ubank",
    "ubs",
    "ug",
    "uk",
    "unicom",
    "university",
    "uno",
    "uol",
    "ups",
    "us",
    "uy",
    "uz",
    "va",
    "vacations",
    "vana",
    "vanguard",
    "vc",
    "ve",
    "vegas",
    "ventures",
    "verisign",
    "vermögensberater",
    "vermögensberatung",
    "versicherung",
    "vet",
    "vg",
    "vi",
    "viajes",
    "video",
    "vig",
    "viking",
    "villas",
    "vin",
    "vip",
    "virgin",
    "visa",
    "vision",
    "viva",
    "vivo",
    "vlaanderen",
    "vn",
    "vodka",
    "volkswagen",
    "volvo",
    "vote",
    "voting",
    "voto",
    "voyage",
    "vu",
    "vuelos",
    "wales",
    "walmart",
    "walter",
    "wang",
    "wanggou",
    "watch",
    "watches",
    "weather",
    "weatherchannel",
    "webcam",
    "weber",
    "website",
    "wed",
    "wedding",
    "weibo",
    "weir",
    "wf",
    "whoswho",
    "wien",
    "wiki",
    "williamhill",
    "win",
    "windows",
    "wine",
    "winners",
    "wme",
    "wolterskluwer",
    "woodside",
    "work",
    "works",
    "world",
    "wow",
    "ws",
    "wtc",
    "wtf",
    "xbox",
    "xerox",
    "xfinity",
    "xihuan",
    "xin",
    "xxx",
    "xyz",
    "yachts",
    "yahoo",
    "yamaxun",
    "yandex",
    "ye",
    "yodobashi",
    "yoga",
    "yokohama",
    "you",
    "youtube",
    "yt",
    "yun",
    "za",
    "zappos",
    "zara",
    "zero",
    "zip",
    "zm",
    "zone",
    "zuerich",
    "zw",
    "ελ",
    "ευ",
    "бг",
    "бел",
    "дети",
    "ею",
    "католик",
    "ком",
    "мкд",
    "мон",
    "москва",
    "онлайн",
    "орг",
    "рус",
    "рф",
    "сайт",
    "срб",
    "укр",
    "қаз",
    "հայ",
    "ישראל",
    "קום",
    "ابوظبي",
    "اتصالات",
    "ارامكو",
    "الاردن",
    "البحرين",
    "الجزائر",
    "السعودية",
    "العليان",
    "المغرب",
    "امارات",
    "ایران",
    "بارت",
    "بازار",
    "بيتك",
    "بھارت",
    "تونس",
    "سودان",
    "سورية",
    "شبكة",
    "عراق",
    "عرب",
    "عمان",
    "فلسطين",
    "قطر",
    "كاثوليك",
    "كوم",
    "مصر",
    "مليسيا",
    "موريتانيا",
    "موقع",
    "همراه",
    "پاکستان",
    "ڀارت",
    "कॉम",
    "नेट",
    "भारत",
    "भारतम्",
    "भारोत",
    "संगठन",
    "বাংলা",
    "ভারত",
    "ভাৰত",
    "ਭਾਰਤ",
    "ભારત",
    "ଭାରତ",
    "இந்தியா",
    "இலங்கை",
    "சிங்கப்பூர்",
    "భారత్",
    "ಭಾರತ",
    "ഭാരതം",
    "ලංකා",
    "คอม",
    "ไทย",
    "ລາວ",
    "გე",
    "みんな",
    "アマゾン",
    "クラウド",
    "グーグル",
    "コム",
    "ストア",
    "セール",
    "ファッション",
    "ポイント",
    "世界",
    "中信",
    "中国",
    "中國",
    "中文网",
    "亚马逊",
    "企业",
    "佛山",
    "信息",
    "健康",
    "八卦",
    "公司",
    "公益",
    "台湾",
    "台灣",
    "商城",
    "商店",
    "商标",
    "嘉里",
    "嘉里大酒店",
    "在线",
    "大拿",
    "天主教",
    "娱乐",
    "家電",
    "广东",
    "微博",
    "慈善",
    "我爱你",
    "手机",
    "招聘",
    "政务",
    "政府",
    "新加坡",
    "新闻",
    "时尚",
    "書籍",
    "机构",
    "淡马锡",
    "游戏",
    "澳門",
    "点看",
    "移动",
    "组织机构",
    "网址",
    "网店",
    "网站",
    "网络",
    "联通",
    "诺基亚",
    "谷歌",
    "购物",
    "通販",
    "集团",
    "電訊盈科",
    "飞利浦",
    "食品",
    "餐厅",
    "香格里拉",
    "香港",
    "닷넷",
    "닷컴",
    "삼성",
    "한국",
];

function getDomain(inputUrl) {
    const parsed = url.parse(inputUrl).host;
    var parts = parsed.split('.');
    if (parts[0] === 'www' && parts[1] !== 'com') {
        parts.shift();
    }
    var ln = parts.length, i = ln, minLength = parts[parts.length - 1].length, part;
    // iterate backwards
    while ((part = parts[--i])) {
        // stop when we find a non-TLD part
        if (i === 0 || // 'asia.com' (last remaining must be the SLD)
            i < ln - 2 || // TLDs only span 2 levels
            part.length < minLength || // 'www.cn.com' (valid TLD as second-level domain)
            tlds.indexOf(part) < 0 // officialy not a TLD
        ) {
            return part;
        }
    }
}
function appendProtocol(inputUrl) {
    const parsed = url.parse(inputUrl);
    if (!parsed.protocol) {
        const urlWithProtocol = `https://${inputUrl}`;
        return urlWithProtocol;
    }
    return inputUrl;
}
function normalizeUrl(urlToNormalize) {
    const urlWithProtocol = appendProtocol(urlToNormalize);
    if (isurl(urlWithProtocol)) {
        return urlWithProtocol;
    }
    else {
        throw new Error(`Your url "${urlWithProtocol}" is invalid`);
    }
}

function validateNumberInput(value) {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        throw new Commander.InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}
function validateUrlInput(url) {
    try {
        return normalizeUrl(url);
    }
    catch (error) {
        throw new Commander.InvalidArgumentError(error.message);
    }
}

const npmDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function promptText(message, initial) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield prompts({
            type: 'text',
            name: 'content',
            message,
            initial,
        });
        return response.content;
    });
}
function mergeTauriConfig(url, options, tauriConf) {
    return __awaiter(this, void 0, void 0, function* () {
        const { width, height, fullscreen, transparent, resizable, identifier, name, } = options;
        const tauriConfWindowOptions = {
            width,
            height,
            fullscreen,
            transparent,
            resizable,
        };
        Object.assign(tauriConf.tauri.windows[0], Object.assign({ url }, tauriConfWindowOptions));
        tauriConf.package.productName = name;
        tauriConf.tauri.bundle.identifier = identifier;
        tauriConf.tauri.bundle.icon = [options.icon];
        if (process.platform === "win32") {
            const ico_path = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}_32.ico`);
            tauriConf.tauri.bundle.resources = [`png/${name.toLowerCase()}_32.ico`];
            yield fs.copyFile(options.icon, ico_path);
        }
        if (process.platform === "linux") {
            const installSrc = `/usr/share/applications/${name}.desktop`;
            const assertSrc = `src-tauri/assets/${name}.desktop`;
            const assertPath = path.join(npmDirectory, assertSrc);
            tauriConf.tauri.bundle.deb.files = {
                [installSrc]: assertPath
            };
        }
        let configPath = "";
        switch (process.platform) {
            case "win32": {
                configPath = path.join(npmDirectory, 'src-tauri/tauri.windows.conf.json');
                break;
            }
            case "darwin": {
                configPath = path.join(npmDirectory, 'src-tauri/tauri.macos.conf.json');
                break;
            }
            case "linux": {
                configPath = path.join(npmDirectory, 'src-tauri/tauri.linux.conf.json');
                break;
            }
        }
        let bundleConf = { tauri: { bundle: tauriConf.tauri.bundle } };
        yield fs.writeFile(configPath, Buffer.from(JSON.stringify(bundleConf), 'utf-8'));
        const configJsonPath = path.join(npmDirectory, 'src-tauri/tauri.conf.json');
        yield fs.writeFile(configJsonPath, Buffer.from(JSON.stringify(tauriConf), 'utf-8'));
    });
}

function getIdentifier(name, url) {
    const hash = crypto.createHash('md5');
    hash.update(url);
    const postFixHash = hash.digest('hex').substring(0, 6);
    return `pake-${postFixHash}`;
}

const logger = {
    info(...msg) {
        log.info(...msg.map((m) => chalk.blue.bold(m)));
    },
    debug(...msg) {
        log.debug(...msg);
    },
    error(...msg) {
        log.error(...msg.map((m) => chalk.red.bold(m)));
    },
    warn(...msg) {
        log.info(...msg.map((m) => chalk.yellow.bold(m)));
    },
    success(...msg) {
        log.info(...msg.map((m) => chalk.green.bold(m)));
    }
};

function handleIcon(options, url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options.icon) {
            if (options.icon.startsWith('http')) {
                return downloadIcon(options.icon);
            }
            else {
                return path.resolve(options.icon);
            }
        }
        if (!options.icon) {
            return inferIcon(options.name);
        }
    });
}
function inferIcon(name, url) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info('You have not provided an app icon, use the default icon.(use --icon option to assign an icon)');
        const npmDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
        return path.join(npmDirectory, 'pake-default.icns');
    });
}
// export async function getIconFromPageUrl(url: string) {
//   const icon = await pageIcon(url);
//   console.log(icon);
//   if (icon.ext === '.ico') {
//     const a = await ICO.parse(icon.data);
//     icon.data = Buffer.from(a[0].buffer);
//   }
//   const iconDir = (await dir()).path;
//   const iconPath = path.join(iconDir, `/icon.icns`);
//   const out = png2icons.createICNS(icon.data, png2icons.BILINEAR, 0);
//   await fs.writeFile(iconPath, out);
//   return iconPath;
// }
// export async function getIconFromMacosIcons(name: string) {
//   const data = {
//     query: name,
//     filters: 'approved:true',
//     hitsPerPage: 10,
//     page: 1,
//   };
//   const res = await axios.post('https://p1txh7zfb3-2.algolianet.com/1/indexes/macOSicons/query?x-algolia-agent=Algolia%20for%20JavaScript%20(4.13.1)%3B%20Browser', data, {
//     headers: {
//       'x-algolia-api-key': '0ba04276e457028f3e11e38696eab32c',
//       'x-algolia-application-id': 'P1TXH7ZFB3',
//     },
//   });
//   if (!res.data.hits.length) {
//     return '';
//   } else {
//     return downloadIcon(res.data.hits[0].icnsUrl);
//   }
// }
function downloadIcon(iconUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        let iconResponse;
        try {
            iconResponse = yield axios.get(iconUrl, {
                responseType: 'arraybuffer',
            });
        }
        catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            throw error;
        }
        const iconData = yield iconResponse.data;
        if (!iconData) {
            return null;
        }
        const fileDetails = yield fileTypeFromBuffer(iconData);
        if (!fileDetails) {
            return null;
        }
        const { path } = yield dir();
        const iconPath = `${path}/icon.${fileDetails.ext}`;
        yield fs.writeFile(iconPath, iconData);
        return iconPath;
    });
}

function handleOptions(options, url) {
    return __awaiter(this, void 0, void 0, function* () {
        const appOptions = Object.assign(Object.assign({}, options), { identifier: '' });
        if (!appOptions.name) {
            appOptions.name = yield promptText('please input your application name', getDomain(url));
        }
        appOptions.identifier = getIdentifier(appOptions.name, url);
        appOptions.icon = yield handleIcon(appOptions);
        return appOptions;
    });
}

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

function shellExec(command) {
    return new Promise((resolve, reject) => {
        shelljs.exec(command, { async: true, silent: false }, (code) => {
            if (code === 0) {
                resolve(0);
            }
            else {
                reject(new Error(`${code}`));
            }
        });
    });
}

const RustInstallScriptFocMac = "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
const RustInstallScriptForWin = 'winget install --id Rustlang.Rustup';
function installRust() {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = ora('Downloading Rust').start();
        try {
            yield shellExec(IS_WIN ? RustInstallScriptForWin : RustInstallScriptFocMac);
            spinner.succeed();
        }
        catch (error) {
            console.error('install rust return code', error.message);
            spinner.fail();
            process.exit(1);
        }
    });
}
function checkRustInstalled() {
    return shelljs.exec('rustc --version', { silent: true }).code === 0;
}

var tauri$3 = {
	windows: [
		{
			url: "https://weread.qq.com/",
			transparent: true,
			fullscreen: false,
			width: 1200,
			height: 728,
			resizable: true
		}
	],
	security: {
		csp: null
	},
	updater: {
		active: false
	}
};
var build = {
	devPath: "../dist",
	distDir: "../dist",
	beforeBuildCommand: "",
	beforeDevCommand: ""
};
var CommonConf = {
	"package": {
	productName: "WeRead",
	version: "1.0.0"
},
	tauri: tauri$3,
	build: build
};

var tauri$2 = {
	bundle: {
		icon: [
			"png/weread_256.ico",
			"png/weread_32.ico"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		externalBin: [
		],
		longDescription: "",
		resources: [
			"png/weread_32.ico"
		],
		shortDescription: "",
		targets: [
			"msi"
		],
		windows: {
			certificateThumbprint: null,
			digestAlgorithm: "sha256",
			timestampUrl: "",
			wix: {
				language: [
					"en-US"
				]
			}
		}
	}
};
var WinConf = {
	tauri: tauri$2
};

var tauri$1 = {
	bundle: {
		icon: [
			"icons/weread.icns"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		externalBin: [
		],
		longDescription: "",
		macOS: {
			entitlements: null,
			exceptionDomain: "",
			frameworks: [
			],
			providerShortName: null,
			signingIdentity: null
		},
		resources: [
		],
		shortDescription: "",
		targets: [
			"dmg"
		]
	}
};
var MacConf = {
	tauri: tauri$1
};

var tauri = {
	bundle: {
		icon: [
			"png/weread_256.ico",
			"png/weread_512.png"
		],
		identifier: "com.tw93.weread",
		active: true,
		category: "DeveloperTool",
		copyright: "",
		deb: {
			depends: [
				"libwebkit2gtk-4.0-dev",
				"build-essential",
				"curl",
				"wget",
				"libssl-dev",
				"libgtk-3-dev",
				"libayatana-appindicator3-dev",
				"librsvg2-dev"
			],
			files: {
				"/usr/share/applications/com-tw93-weread.desktop": "assets/com-tw93-weread.desktop"
			}
		},
		externalBin: [
		],
		longDescription: "",
		resources: [
		],
		shortDescription: "",
		targets: [
			"deb"
		]
	}
};
var LinuxConf = {
	tauri: tauri
};

let tauriConf = {
  package: CommonConf.package,
  tauri: CommonConf.tauri
};
switch (process.platform) {
  case "win32": {
    tauriConf.tauri.bundle = WinConf.tauri.bundle;
    break;
  }
  case "darwin": {
    tauriConf.tauri.bundle = MacConf.tauri.bundle;
    break;
  }
  case "linux": {
    tauriConf.tauri.bundle = LinuxConf.tauri.bundle;
    break;
  }
}

class MacBuilder {
    prepare() {
        return __awaiter(this, void 0, void 0, function* () {
            if (checkRustInstalled()) {
                return;
            }
            const res = yield prompts({
                type: 'confirm',
                message: 'We detected that you have not installed Rust. Install it now?',
                name: 'value',
            });
            if (res.value) {
                // TODO 国内有可能会超时
                yield installRust();
            }
            else {
                log.error('Error: Pake need Rust to package your webapp!!!');
                process.exit(2);
            }
        });
    }
    build(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            log.debug('PakeAppOptions', options);
            const { name } = options;
            yield mergeTauriConfig(url, options, tauriConf);
            yield shellExec(`cd ${npmDirectory} && npm install && npm run build`);
            let arch = "x64";
            if (process.arch === "arm64") {
                arch = "aarch64";
            }
            else {
                arch = process.arch;
            }
            const dmgName = `${name}_${tauriConf.package.version}_${arch}.dmg`;
            const appPath = this.getBuildedAppPath(npmDirectory, dmgName);
            const distPath = path.resolve(`${name}.dmg`);
            yield fs.copyFile(appPath, distPath);
            yield fs.unlink(appPath);
            logger.success('Build success!');
            logger.success('You can find the app installer in', distPath);
        });
    }
    getBuildedAppPath(npmDirectory, dmgName) {
        return path.join(npmDirectory, 'src-tauri/target/release/bundle/dmg', dmgName);
    }
}

class WinBuilder {
    prepare() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.info('To build the Windows app, you need to install Rust and VS Build Tools.');
            logger.info('See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing\n');
            if (checkRustInstalled()) {
                return;
            }
            const res = yield prompts({
                type: 'confirm',
                message: 'We detected that you have not installed Rust. Install it now?',
                name: 'value',
            });
            if (res.value) {
                // TODO 国内有可能会超时
                yield installRust();
            }
            else {
                logger.error('Error: Pake needs Rust to package your webapp!!!');
                process.exit(2);
            }
        });
    }
    build(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('PakeAppOptions', options);
            const { name } = options;
            yield mergeTauriConfig(url, options, tauriConf);
            yield shellExec(`cd ${npmDirectory} && npm install && npm run build`);
            const language = tauriConf.tauri.bundle.windows.wix.language[0];
            const arch = process.arch;
            const msiName = `${name}_${tauriConf.package.version}_${arch}_${language}.msi`;
            const appPath = this.getBuildedAppPath(npmDirectory, msiName);
            const distPath = path.resolve(`${name}.msi`);
            yield fs.copyFile(appPath, distPath);
            yield fs.unlink(appPath);
            logger.success('Build success!');
            logger.success('You can find the app installer in', distPath);
        });
    }
    getBuildedAppPath(npmDirectory, dmgName) {
        return path.join(npmDirectory, 'src-tauri/target/release/bundle/msi', dmgName);
    }
}

class LinuxBuilder {
    prepare() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.info('To build the Linux app, you need to install Rust and Linux package');
            logger.info('See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing\n');
            if (checkRustInstalled()) {
                return;
            }
            const res = yield prompts({
                type: 'confirm',
                message: 'We detected that you have not installed Rust. Install it now?',
                name: 'value',
            });
            if (res.value) {
                // TODO 国内有可能会超时
                yield installRust();
            }
            else {
                logger.error('Error: Pake needs Rust to package your webapp!!!');
                process.exit(2);
            }
        });
    }
    build(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('PakeAppOptions', options);
            const { name } = options;
            yield mergeTauriConfig(url, options, tauriConf);
            // write desktop
            const assertSrc = `src-tauri/assets/${name}.desktop`;
            const assertPath = path.join(npmDirectory, assertSrc);
            const desktopStr = `
[Desktop Entry]
Encoding=UTF-8
Categories=Office
Exec=${name}
Icon=${name}
Name=${name}
StartupNotify=true
Terminal=false
Type=Application
    `;
            yield fs.writeFile(assertPath, desktopStr);
            yield shellExec(`cd ${npmDirectory} && npm install && npm run build`);
            let arch = "";
            if (process.arch === "x64") {
                arch = "amd64";
            }
            else {
                arch = process.arch;
            }
            const debName = `${name}_${tauriConf.package.version}_${arch}.deb`;
            const appPath = this.getBuildedAppPath(npmDirectory, debName);
            const distPath = path.resolve(`${name}.deb`);
            yield fs.copyFile(appPath, distPath);
            yield fs.unlink(appPath);
            logger.success('Build success!');
            logger.success('You can find the app installer in', distPath);
        });
    }
    getBuildedAppPath(npmDirectory, dmgName) {
        return path.join(npmDirectory, 'src-tauri/target/release/bundle/deb', dmgName);
    }
}

class BuilderFactory {
    static create() {
        console.log("now platform is ", process.platform);
        if (IS_MAC) {
            return new MacBuilder();
        }
        if (IS_WIN) {
            return new WinBuilder();
        }
        if (IS_LINUX) {
            return new LinuxBuilder();
        }
        throw new Error('The current system does not support!!');
    }
}

var name = "pake-cli";
var version = "0.1.1";
var description = "🤱🏻 很简单的用 Rust 打包网页生成很小的桌面 App 🤱🏻 A simple way to make any web page a desktop application using Rust.";
var bin = {
	pake: "./cli.js"
};
var repository = {
	type: "git",
	url: "https://github.com/tw93/pake.git"
};
var author = {
	name: "Tw93",
	email: "tw93@qq.com"
};
var files = [
	"dist",
	"src-tauri",
	"cli.js",
	"pake-default.icns"
];
var scripts = {
	start: "npm run dev",
	dev: "npm run tauri dev",
	"dev:debug": "npm run tauri dev -- --features devtools",
	build: "npm run tauri build --release",
	"build:all-unix": "chmod +x ./script/build.sh && ./script/build.sh",
	"build:all-windows": ".\\script\\build.bat",
	tauri: "tauri",
	cli: "rollup -c rollup.config.js --watch",
	"cli:build": "cross-env NODE_ENV=production rollup -c rollup.config.js",
	"cli:publish": "npm run cli:build && npm publish"
};
var type = "module";
var exports = "./dist/pake.js";
var license = "MIT";
var dependencies = {
	"@tauri-apps/api": "^1.2.0",
	"@tauri-apps/cli": "^1.2.1",
	axios: "^1.1.3",
	chalk: "^5.1.2",
	commander: "^9.4.1",
	"file-type": "^18.0.0",
	"is-url": "^1.2.4",
	loglevel: "^1.8.1",
	ora: "^6.1.2",
	prompts: "^2.4.2",
	shelljs: "^0.8.5",
	"tmp-promise": "^3.0.3",
	"update-notifier": "^6.0.2"
};
var devDependencies = {
	"@rollup/plugin-alias": "^4.0.2",
	"@rollup/plugin-commonjs": "^23.0.2",
	"@rollup/plugin-json": "^5.0.1",
	"@rollup/plugin-terser": "^0.1.0",
	"@rollup/plugin-typescript": "^9.0.2",
	"@types/is-url": "^1.2.30",
	"@types/page-icon": "^0.3.4",
	"@types/prompts": "^2.4.1",
	"@types/shelljs": "^0.8.11",
	"@types/tmp": "^0.2.3",
	"@types/update-notifier": "^6.0.1",
	"app-root-path": "^3.1.0",
	concurrently: "^7.5.0",
	"cross-env": "^7.0.3",
	rollup: "^3.3.0",
	tslib: "^2.4.1",
	typescript: "^4.9.3"
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	bin: bin,
	repository: repository,
	author: author,
	files: files,
	scripts: scripts,
	type: type,
	exports: exports,
	license: license,
	dependencies: dependencies,
	devDependencies: devDependencies
};

function checkUpdateTips() {
    return __awaiter(this, void 0, void 0, function* () {
        updateNotifier({ pkg: packageJson }).notify();
    });
}

program.version(packageJson.version).description('A cli application can package a web page to desktop application.');
program
    .showHelpAfterError()
    .argument('[url]', 'the web url you want to package', validateUrlInput)
    .option('--name <string>', 'application name')
    .option('--icon <string>', 'application icon', DEFAULT_PAKE_OPTIONS.icon)
    .option('--height <number>', 'window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
    .option('--width <number>', 'window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
    .option('--no-resizable', 'whether the window can be resizable', DEFAULT_PAKE_OPTIONS.resizable)
    .option('--fullscreen', 'makes the packaged app start in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
    .option('--transparent', 'transparent title bar', DEFAULT_PAKE_OPTIONS.transparent)
    .option('--debug', 'debug', DEFAULT_PAKE_OPTIONS.transparent)
    .action((url, options) => __awaiter(void 0, void 0, void 0, function* () {
    checkUpdateTips();
    if (!url) {
        // 直接 pake 不需要出现url提示
        program.help();
    }
    log.setDefaultLevel('info');
    if (options.debug) {
        log.setLevel('debug');
    }
    const builder = BuilderFactory.create();
    yield builder.prepare();
    const appOptions = yield handleOptions(options, url);
    builder.build(url, appOptions);
}));
program.parse();
