# Lexus OBD Flex 0.7.1 — koonti- ja testiraportti

Päiväys: 2026-08-12  
Kohteet: Lexus CT 200h ZWA10 / 2ZR-FXE ja Lexus IS220d XE20 / 2AD-FHV  
Paketin tunnus: `fi.oliver.is220dobd`

## Tulos

Flex 0.7.1 lisää CT 200h:n ohjatun ostotarkastuksen. Debug- ja release-APK:t
rakentuivat onnistuneesti, kaikki **118/118** automaattista testiä hyväksyttiin,
JavaScript-syntaksi tarkistui ja molempien APK:iden ZIP-rakenne oli ehjä.

Sovellus on edelleen tarkoituksella vain luku CT:n valmistajakohtaisissa
toiminnoissa. Ostotesti ei lähetä Active Test-, Mode 04-, ECU-kirjoitus-,
koodaus-, turva-avain-, pakkolataus- tai ohjelmointikomentoja.

## Ostotarkastuksen kattavuus

| Osa | Toteutus | Hyväksymisehto |
|---|---|---|
| Ajoneuvon vahvistus | `7E2/7EA`, `21C1` | Positiivinen vastaus sisältää `ZWA10` |
| EOBD-koodit | Mode 03, 07 ja 0A | Jokaiselle kelvollinen positiivinen vastaus |
| Readiness / nollaus | PID 01, 30, 31, 4D ja 4E | Tiedot raportoidaan; keskeneräisyys/nollausepäily nostetaan |
| Moottorin esitiedot | PID 05, 06, 07, 0C, 2C, 2D ja 42 | Tuettu arvo säilytetään raportissa |
| HV-esitarkastus | `2101`, `2181`, `2187`, `2195`, `2198` | Täydellinen ISO-TP ja profiilin järkevyysrajat |
| Hybridikoodit | `7E2/7EA`, `0A` ja `13B0` | Molemmille positiivinen vastaus |
| Jarru-ECU | kokeellinen `7B0/7B8`, `13B0` | Vain kelvollinen `53`-vastaus; muuten kattavuus puuttuu |
| HV-koeajo | paikallaan, purku, regenerointi | vähintään 3 / 5 / 5 tuoretta näytettä |
| Manuaalihavainnot | kylmäkäynti, varoitusvalot, jarrupumppu | kaikki kolme kirjattu |
| Raportti | TXT + raakavastaukset + näyte-JSON | valmis myös vajavaisena, mutta tila on `incomplete` |

Jokainen HV-näyte vaatii kaikki 14 lohkojännitettä ja akkuvirran. Mittausten
enimmäisikä on 2,2 sekuntia. Vaiheluokitus käyttää läpinäkyviä ehtoja:

- paikallaan: virran itseisarvo enintään 5 A ja nopeus enintään 3 km/h
- purku: virta vähintään +20 A
- regenerointi: virta enintään −15 A
- muu tila: siirtymänä tallennettava näyte, joka ei täytä vaihekattavuutta.

## Analyysipolitiikka

Flex ei laske HV-akulle kapasiteetti- tai SOH-prosenttia. Lohkoeroa,
lämpötilaa ja vastushajontaa käsitellään ostoseulontana, ei Lexuksen
vikakoodi- tai korjausrajoina.

Flexin lohkoeron huomioraja on 0,200 V ja vahvan huolen raja 0,300 V.
Pysäytyshavainto vaatii 0,300 V lisäksi saman alimman lohkon toistumisen
vähintään puolessa vähintään kuudesta kuormitusnäytteestä. P0A80/P3000,
C1391/C1252/C1253/C1256, P0300–P0304, palavat varoitusvalot, poikkeava
jarrupumppu ja kylmäkäynnin ravistus/kolina käsitellään erikseen. P0401,
readinessin keskeneräisyys ja mahdollinen tuore nollaus nostetaan huomioiksi.

Tulosluokat ovat `stop`, `incomplete`, `attention` ja `ready`. Stop-havainto
säilyy pysäyttävänä myös silloin, kun koeajo on vajaa. Ilman ZWA10-tunnistusta,
vaadittuja DTC-vastauksia, readinessia, kaikkia kolmea HV-vaihetta ja
manuaalihavaintoja tulos ei voi olla `ready`.

## Uudet regressiotestit

0.7.1 lisää viisi ostotarkastuksen testiä:

1. readinessin sekä PID 30/31/42 -arvojen purku
2. paikallaan-, purku-, regenerointi- ja vanhentuneen näytteen luokitus
3. kattavan normaalin seulonnan raportti ilman SOH-väitettä
4. P0A80- ja C1391-löydösten pysäytys vajavaisellakin koeajolla
5. jarru-ECU:n oma 7B0/7B8-transaktio, C1391-parseri ja 7E0-palautus.

Koko komento `npm test` hyväksyi **118 testiä, 0 epäonnistunutta ja 0
ohitettua**. Aiemmat IS220d-, CT-live-, Classic/BLE-, vLinker-, Quicklynks-,
ISO-TP-, replay-, pollaus-, CSV-, btsnoop-, tiedostonvalitsin- ja
Android-natiivisiltatestit säilyivät hyväksyttyinä.

## APK-auditointi

| Tarkistus | Tulos |
|---|---|
| Sovelluksen nimi | `Lexus OBD Flex` |
| Paketti | `fi.oliver.is220dobd` |
| versionName / versionCode | `0.7.1` / `701` |
| minSdk / targetSdk | `21` / `34` |
| INTERNET-oikeus | Ei ole |
| Bluetooth-oikeudet | BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN |
| Sijaintioikeus | ACCESS_FINE_LOCATION vanhojen Android-versioiden BLE-hakua varten |
| Selväkielinen verkkoliikenne | `usesCleartextTraffic=false` |
| APK:n ZIP-eheys | `unzip -t`: ei virheitä kummassakaan APK:ssa |
| Pakolliset tiedostot | manifesti, `classes.dex`, `assets/index.html`, `assets/app.bundle.js` löytyvät |
| Allekirjoitusrakenne | `ANDROIDD.SF/.RSA` ja `APK Sig Block 42` löytyvät |
| Allekirjoituksen SHA-256 | `1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53` |
| Päivitettävyys 0.7.0:n päälle | Sama paketti ja sama allekirjoitus; versionCode 700 → 701 |

Release-APK:n WebView-sisällöstä löytyivät uusi Ostotesti-sivu,
kapasiteetti-/SOH-rajaus, kattavuusluokitus, keskeiset vikakoodit ja
raakavastausraportti. Manifestissa ei ole INTERNET-oikeutta.

## APK-tiedostot

| Tiedosto | Koko | SHA-256 |
|---|---:|---|
| `Lexus_OBD-Flex-0.7.1-release.apk` | 169 549 tavua | `20f79f2156398254f7ca64f56ccbecba6192ff80e2caa926793273cc665dd752` |
| `Lexus_OBD-Flex-0.7.1-debug.apk` | 190 029 tavua | `40d01295b4d520f354fe22900aa3728ec1e48d801b80f262a2feb89fe4dc5835` |

## Evidenssi ja rajaukset

- Toyota/Lexus CT200h Dismantling Guide vahvistaa 201,6 V NiMH-akun ja 28
  sarjaan kytkettyä 7,2 V moduulia.
- Lexus CSP 21LE01 nimeää 2011–2013 CT 200h:n brake booster / pump assembly
  -tapauksissa DTC:t C1391, C1252, C1256 ja C1253.
- Lexus L-SB-0028-13 ja Warranty Enhancement ZLF kuvaavat P0401- sekä
  kylmäkäynnin rough idle / rattle -tapauksia 2011–2012 CT 200h:ssa.
- Korjausohjeen P0A80-polku ja Data List tukevat lohkojännitteiden, sisäisten
  vastusten ja Delta SOC:n tarkastelua; P0A80 voi vaatia ajon ja INF-lisäkoodin.
- Käyttäjän toimittama Techstream-arkisto tarkastettiin staattisesti eikä
  virtuaalikonetta tai ohjelmaa suoritettu. Techstreamia tai korjausohjetta ei
  sisällytetä jakeluun.
- Jarru-ECU:n `7B0/7B8`-osoitus on Toyota Gen3 -tutkimuskandidaatti, ei tässä
  työssä fyysisellä CT 200h:lla varmennettu fakta. Siksi vastaamattomuus
  merkitään puuttuvaksi kattavuudeksi ja ohjeena on Techstream Health Check.

Lähteet:

- https://techinfo.toyota.com/techInfoPortal/staticcontent/en/techinfo/html/prelogin/docs/ct200hdisman.pdf
- https://static.nhtsa.gov/odi/tsbs/2021/MC-10198146-9999.pdf
- https://static.nhtsa.gov/odi/tsbs/2013/SB-10062364-2273.pdf
- https://static.nhtsa.gov/odi/tsbs/2016/MC-10134094-9999.pdf
- https://jdmfsm.info/Auto/Japan/Lexus/CT200h/Lexus%20CT200h%20Service%20Manual/rm1720e/repair2/html/frame_rm0000025ai024x.html

## Kenttävarmennuksen tila

0.7.1 on koottu, auditoitu ja testattu synteettisillä normaali- ja
häiriöaineistoilla, mutta tätä julkaisua ei ole tämän työn aikana kytketty
fyysiseen Lexus CT 200h:hon. Ensimmäinen autokoe tehdään paikallaan,
raakavastaukset tallennetaan ja kokeellisen jarru-ECU:n tulosta verrataan
Techstream Health Checkiin ennen kuin osoituksen evidenssitasoa voidaan
nostaa.
