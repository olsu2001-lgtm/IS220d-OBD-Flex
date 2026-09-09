# Lexus OBD Flex 0.7.7 · rakennus- ja testiraportti

Päivä: 2026-08-18  
Pakettitunnus: `fi.oliver.is220dobd`  
Versio: `versionName 0.7.7`, `versionCode 707`

## Toteutettu muutos

- IS220d / 2AD-FHV -profiiliin lisättiin erillinen vain lukeva suutinten
  tasapaino- ja vuotoepäilyseulonta.
- Mittaus kestää noin 45 sekuntia ja kerää `010C`, `0105`, `2193`, `2196`
  sekä `219C` -vastaukset.
- Raportti sisältää olosuhteet, sylinterikohtaiset tilastot, kaikki
  näytekohtaiset raakavastaukset, virheet ja tekoälylle valmiin
  analyysiohjeen.
- Käyttöliittymä erottaa OBD-korjausarvoseulonnan varsinaisesta
  paluuvirta-/leak-off-testistä. Testi ei väitä korjausarvon perusteella
  varmaa vuotoa tai vaihtotarvetta.
- Quicklynks estetään tässä testissä, koska sen varmennettu FFF6-polku ei
  tue Toyota 21xx -kyselyitä.
- Tunnistamattoman auton laaja diagnostiikkaraportti ei enää nimeä autoa
  virheellisesti IS220d:ksi.

## Turvallisuusraja

Suutintestin lukukomennot ovat:

`010C`, `0105`, `2193`, `2196`, `219C`

Testi ei sisällä Mode 04 -poistoa, UDS/KWP-kirjoitusta, Active Test
-palvelua, koodausta eikä regeneroinnin käynnistystä. CAN-asetukset
palautetaan testin jälkeen, ja taustalle siirtyminen tai käyttäjän
keskeytys viimeistelee nykyisen lukukierroksen sekä muodostaa raportin jo
saaduista näytteistä.

## Tulkintaperusta

- Lexus-korjaamokäsikirjan Data List: `Injection Feedback Val #1–#4`
- mittausolosuhde: lämmin moottori, tyhjäkäynti, A/C ja lisälaitteet pois
- tavanomainen alue: `−3,0…+3,0 mm³`
- huoltoraja: korjausarvon itseisarvo enintään `4,9 mm³`
- common rail -paineen tyhjäkäyntiviite: `37–43 MPa`

`2193`, `2196`, `219C` ja niiden muunnokset ovat Techstream-aineistosta
johdettuja. Ne on erotettu normaalista tuotantolive-profiilista ja niitä
käytetään vain käyttäjän käynnistämässä suutintestissä. Fyysistä
ajoneuvotestiä ei voitu suorittaa tässä rakennusympäristössä; ensimmäisen
autotestin raportti kannattaa tarkistaa ennen diagnoosipäätöksiä.

## Automaattitestit

- `npm test`: **153/153 PASS**
- Node-syntaksitarkastus: PASS
- debug-bundlen käyttöliittymäsavutesti: PASS
- release-bundlen käyttöliittymäsavutesti: PASS
- savutestissä varmennettiin teema, navigaatio, Bluetooth-lista ja
  suutintestin tapahtumankäsittelijä
- APK-rakennus: debug PASS, release PASS

## APK-varmennus

- `applicationId`: `fi.oliver.is220dobd`
- `versionCode`: `707`
- `versionName`: `0.7.7`
- `minSdkVersion`: `21`
- `targetSdkVersion`: `34`
- `INTERNET`-oikeutta ei ole
- oikeudet: Bluetooth, Bluetooth Admin, Bluetooth Connect, Bluetooth Scan,
  Fine Location
- allekirjoittajan SHA-256:
  `1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53`
- allekirjoitus vastaa aiemman Flex 0.7.5 -rakennuksen varmennettua
  allekirjoitusta; 0.7.7 voidaan asentaa saman paketin päivitykseksi, jos
  puhelimessa oleva versio käyttää samaa allekirjoitusta

## Tiedostot ja SHA-256

- `Lexus_OBD-Flex-0.7.7-release.apk` · 198221 tavua  
  `158965ea01194fb3af680b38737785229102915eb93a7ff6680f75dce3fd04e9`
- `Lexus_OBD-Flex-0.7.7-debug.apk` · 226893 tavua  
  `5eaf5ca8597cf70391856d5517650693428eaeda88182df7d15e4f7fcf4256fc`

Release-APK on suositeltu normaaliin asennukseen. Debug-APK sisältää
minimoimattoman JavaScript-bundlen vianetsintää varten.
