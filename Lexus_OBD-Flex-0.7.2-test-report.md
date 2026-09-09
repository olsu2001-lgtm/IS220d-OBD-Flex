# Lexus OBD Flex 0.7.2 — koonti- ja testiraportti

Päiväys: 2026-08-12  
Kohteet: Lexus IS220d XE20 / 2AD-FHV ja Lexus CT 200h ZWA10 / 2ZR-FXE  
Paketin tunnus: `fi.oliver.is220dobd`

## Tulos

Flex 0.7.2 lisää GPS/OBD-tehotestin kiihtyvyysaikoihin ja ajonaikaiseen
tehoarvioon. Debug- ja release-APK:t rakentuivat onnistuneesti, kaikki
**129/129** automaattista testiä hyväksyttiin, JavaScript-syntaksi tarkistui
ja molempien APK:iden ZIP-rakenne oli ehjä.

Tehotesti ei muuta aiempaa ECU-turvallisuusrajaa. OBD on lisämittauslähde ja
käyttää nykyisiä vain lukevia livepyyntöjä; sovellukseen ei lisätty Mode 04-,
Active Test-, ECU-kirjoitus-, koodaus-, turva-avain-, pakkolataus- tai
ohjelmointikomentoja.

## Tehotestin kattavuus

| Osa | Toteutus | Hyväksymisehto |
|---|---|---|
| Ajan lähde | Android `Location.getElapsedRealtimeNanos()` | monotoninen aika ja kasvava näytejärjestys |
| Nopeus | GPS-palvelun `Location.getSpeed()` | kelvollinen 0–350 km/h nopeus |
| Nopeusvälit | 0–100, 80–120, 0–60 mph, 60–120 ja oma väli | alku- ja loppurajan interpoloitu ylitys |
| Väliajat | nopeusväliin osuvat yleiset rajat | interpoloitu monotoniseen aikajanaan |
| OBD-lisädata | nykyinen turvallinen livepolku | yhteys vapaaehtoinen; GPS toimii yksin |
| Tehomalli | liike-energia + vierintä + kaltevuus + ilmanvastus | vähintään kaksi kelvollista rajanäytettä |
| Huipputeho | noin 1 s ikkunoiden 90. persentiili | positiiviset kelvolliset tehoikkunat |
| Laatu | näytetaajuus, katkot, tarkkuus, suunta, OBD-ero, mock | vähintään 65 pistettä, 1,5 Hz ja enintään 2 s katko |
| Vienti | TXT ja CSV | asetukset, laatu, tulokset ja reititön raakadata |
| Historia | paikallinen enintään 12 vetoa | vertailu vain samalle autolle ja nopeusvälille |

Tehoarvio erottaa koko välin keskimääräisen pyörätehon, robustin
huippupyörätehon ja voimansiirron hyötysuhteella korjatun IS220d:n
moottoriteho- tai CT 200h:n järjestelmätehoarvion. Arvo on fysikaalinen
tiearvio, ei dynamometrimittaus tai kuntotodistus.

## GPS-tietosuoja ja turvallisuus

Natiivi `PowerGpsBridge` pyytää GPS-päivityksiä pääsäikeen looperilla ja
välittää monotonisen ajan, nopeuden, korkeuden, suunnan, vaakatarkkuuden,
nopeustarkkuuden, suuntatarkkuuden, pystytarkkuuden, palveluntarjoajan ja
valesijaintitiedon. Lähteessä tai kootussa `classes.dex`-tiedostossa ei ole
`getLatitude`- tai `getLongitude`-kutsuja. Kootun WebView-sovelluksen
tehotestimallissa ei ole `latitude`- tai `longitude`-kenttiä.

Käyttöliittymä varoittaa, ettei kuljettaja käytä puhelinta ja ettei nopeuksia
testata liikennesääntöjen vastaisesti. Sovellus keskeyttää aktiivisen testin,
jos WebView siirtyy taustalle. Androidin valesijaintinäyte keskeyttää testin.

## Uudet regressiotestit

0.7.2 lisää 10 tehotestin toiminnallista testiä:

1. IS220d- ja CT 200h -oletusten sekä tehotyypin erottelu
2. Androidin monotonisen ajan ja GPS-nopeuden normalisointi ilman reittiä
3. 0–100-ajanoton viritys, rajainterpolointi ja väliajat
4. 80–120-rullaavan testin alku- ja loppuraja
5. pyörä- ja häviökorjatun tehon erilliset tulokset
6. heikon 1 Hz GPS:n hylkäys tehovertailusta
7. valesijaintinäytteen aiheuttama keskeytys
8. TXT-/CSV-raportin asetukset, laatu ja reitittömyys
9. historian rajaus samaan ajoneuvoon ja nopeusväliin
10. Androidin natiivijonon tyhjennys ja hallittu pysäytys.

Lisäksi Android-lähdetesti tarkistaa GPS-sillan rekisteröinnin,
`ACCESS_FINE_LOCATION`-oikeuden, monotonisen ajan, nopeustarkkuuden,
valesijaintitiedon, tehotesti-UI:n, raporttimallin, koordinaattikutsujen
puuttumisen ja internetoikeuden puuttumisen.

Koko komento `npm test` hyväksyi **129 testiä, 0 epäonnistunutta ja 0
ohitettua**. Aiemmat IS220d-, CT-live-, CT-ostotarkastus-, Classic/BLE-,
vLinker-, Quicklynks-, ISO-TP-, replay-, pollaus-, CSV-, btsnoop-,
tiedostonvalitsin- ja Android-natiivisiltatestit säilyivät hyväksyttyinä.

## APK-auditointi

| Tarkistus | Tulos |
|---|---|
| Sovelluksen nimi | `Lexus OBD Flex` |
| Paketti | `fi.oliver.is220dobd` |
| versionName / versionCode | `0.7.2` / `702` |
| minSdk / targetSdk | `21` / `34` |
| INTERNET-oikeus | Ei ole |
| Bluetooth-oikeudet | BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN |
| Sijaintioikeus | ACCESS_FINE_LOCATION GPS-nopeuteen ja vanhempien Androidien BLE-hakuun |
| Selväkielinen verkkoliikenne | `usesCleartextTraffic=false` |
| APK:n ZIP-eheys | `unzip -t`: ei virheitä kummassakaan APK:ssa |
| Pakolliset tiedostot | manifesti, `classes.dex`, `assets/index.html`, `assets/app.bundle.js` löytyvät |
| Allekirjoitusrakenne | `ANDROIDD.SF/.RSA` ja `APK Sig Block 42` löytyvät |
| Allekirjoituksen SHA-256 | `1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53` |
| Päivitettävyys 0.7.1:n päälle | Sama paketti ja sama allekirjoitus; versionCode 701 → 702 |

Release-APK:n WebView-sisällöstä löytyivät Tehotesti-sivu, kaikki viisi
nopeusvälivaihtoehtoa, laatu- ja tehotuloskentät sekä reittikoordinaattien
tallentamattomuudesta kertova rajaus. `classes.dex` sisältää
`PowerGpsBridge`-sillan, GPS-päivityspyynnön, monotonisen ajan,
nopeustarkkuuden ja valesijaintitarkistuksen.

Nitron 1.3:n oma ennakkovalidaattori varoittaa Android 12:n
`BLUETOOTH_CONNECT`- ja `BLUETOOTH_SCAN`-nimistä, mutta `aapt2`-auditointi
vahvisti molemmat oikeudet oikein kootussa manifestissa.

## APK-tiedostot

| Tiedosto | Koko | SHA-256 |
|---|---:|---|
| `Lexus_OBD-Flex-0.7.2-release.apk` | 185 933 tavua | `f2e558c6d1a6d2329dca67f0dd2c1dd551328b7a903b6c29a64643c1b7e8be2c` |
| `Lexus_OBD-Flex-0.7.2-debug.apk` | 210 509 tavua | `2c3584dda3ec383bab5d10d7d54cab12a79d7f9ad622fc1819aced0bd066e36d` |

## Evidenssi ja rajaukset

- Lexuksen virallinen IS-esittely ilmoittaa IS220d:n tehoksi 130 kW / 177 DIN
  hv, 0–100 km/h -ajaksi 8,9 s, Cd-arvoksi 0,27 ja omamassaksi 1585–1655 kg.
- Lexuksen virallinen CT-aineisto ilmoittaa hybridijärjestelmän tehoksi
  100 kW / 136 DIN hv ja 0–100 km/h -ajaksi 10,3 s. Teknisen taulukon
  omamassa on 1370 kg ja Cd-arvo 0,29.
- Androidin virallinen `Location`-rajapinta tarjoaa monotonisen
  `elapsedRealtimeNanos`-ajan ja SI-yksiköissä ilmoitetun GPS-nopeuden sekä
  sen tarkkuustiedon. Toteutus ei tallenna sijaintikoordinaatteja.
- Massan, tien kaltevuuden, lämpötilan, ilmanpaineen, Cd:n, otsapinta-alan,
  vierintävastuksen ja voimansiirtohäviön oletukset vaikuttavat tulokseen.
  Tuulta ei mitata, joten vastakkaisiin suuntiin tehdyt vedot ovat suositeltuja.
- 0.7.2 on koottu, auditoitu ja testattu synteettisillä normaali- ja
  häiriöaineistoilla, mutta tätä julkaisua ei ole tämän työn aikana testattu
  fyysisessä autossa tai vertailtu kalibroituun dynamometriin.

Lähteet:

- https://media.lexus.co.uk/introducing-the-new-lexus-is/
- https://media.lexus.co.uk/introducing-the-lexus-ct-200h-2/
- https://newsroom.lexus.eu/the-refreshed-ct-200h/
- https://developer.android.com/reference/android/location/LocationManager
- https://developer.android.com/reference/android/location/Location
