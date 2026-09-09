# Lexus OBD Flex 0.7.5 · korjaus- ja rakennusraportti

Päivä: 15.8.2026  
Paketti: `fi.oliver.is220dobd`  
Versio: `versionName 0.7.5`, `versionCode 705`

## Käyttäjän ilmoittama vika

Flex 0.7.3:n etusivu avautui, mutta:

- teeman valinta ei muuttanut ulkoasua;
- Bluetooth-laitelista ei avautunut tai täyttynyt;
- alanavigaatiosta ei voinut avata muita sivuja.

## Juurisyy

APK:n `app.bundle.js` keskeytyi käynnistysvirheeseen `_c is not defined`.
Esbuild 0.28.1 oli muuntanut teemakontrollerin oletusparametrissa olevan
valinnaisen `document?.querySelector?.(...)`-kutsun virheelliseksi IIFE-koodiksi,
jossa metodikutsun vastaanottajaksi viitattiin nuolifunktion ulkopuoliseen
määrittelemättömään `_c`-muuttujaan.

Virhe tapahtui ennen `attachEvents()`-kutsua. Siksi samalla kertaa jäivät
rekisteröimättä teeman, navigaation ja Bluetooth-päivityksen tapahtumankäsittelijät.

## Korjaus

- WebView-oletukset muodostetaan nyt tavallisilla apufunktioilla ilman
  bundlerissa rikkoutuvaa valinnaista metodikutsua.
- Rakennus ajaa jokaiselle debug- ja release-bundlelle uuden käyttöliittymän
  savutestin ennen APK:n muodostamista.
- Savutesti käynnistää oikean `index.html + app.bundle.js` -kokonaisuuden ja
  varmistaa teeman vaihdon, Live-sivulle siirtymisen sekä Bluetooth-listan
  täyttymisen.
- Flex 0.7.4:n automaattinen ajoneuvotunnistus ja aiemmat read-only OBD-polut
  säilyvät.

## Testit ja tarkistukset

- Automaattitestit: **146/146 hyväksytty**.
- Paketoidun debug-bundlen UI-savutesti: **PASS**.
- Paketoidun release-bundlen UI-savutesti: **PASS**.
- Valmiista release-APK:sta puretun käyttöliittymän UI-savutesti: **PASS**.
- Pakettitunnus: `fi.oliver.is220dobd`.
- Android: `minSdk 21`, `targetSdk 34`.
- Oikeudet: Bluetooth, Bluetooth Admin, Bluetooth Connect, Bluetooth Scan ja
  tarkka sijainti; ei Internet-oikeutta.
- `usesCleartextTraffic=false`.
- Allekirjoitussertifikaatin SHA-256 vastaa Flex 0.7.3:a:
  `1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53`.

## SHA-256

- Release APK: `937032423b4b654886293f96289bbf0a1339a6d6012e000d0e1ea1686aa3fb3c`
- Debug APK: `34c4c325899dd5909ef0f9b31d9b26ec85f0550e4967d6fddb1299190f226b5d`
