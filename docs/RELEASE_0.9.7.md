# Lexus OBD Flex 0.9.7

## Health Check ja käyttöliittymä

- Uusi diagnoosikeskeinen päänavigaatio: **Tila / Live / Testit / Lisää**.
- Uusi visuaalinen Health Check -etusivu, joka erottaa vahvistetut havainnot, datan saatavuuden, puuttuvan datan ja vikakoodilöydökset.
- iOS-henkinen mobiili-ilme: safe-area-tuki, kelluva tab bar, selkeämpi typografia, ryhmitellyt kortit ja vähintään 44 px kosketuskohteet.
- Testit ja asiantuntijatyökalut on ryhmitelty omiin näkymiinsä; ajoneuvokohtaiset työkalut suodatetaan tunnistetun profiilin mukaan.

## Live-data

- Ydinarvot nostettu raakadatamassan edelle.
- Live-kuvaaja tuotu lähemmäs olennaisia mittareita.
- Kaikki mittarit -lista on oletuksena piilossa ja siinä on haku sekä erillinen ei-tuettujen arvojen näyttö.
- Puuttuva/ei-tuettu arvo ei enää saa näyttäytyä validina numeerisena nollana UI:n Health Check -tulkinnassa.

## IS220d-viitevertailu

Saatuja IS220d Live-arvoja verrataan varmennettuihin käyttötilakohtaisiin viitteisiin silloin, kun vertailuehto täyttyy:

- lämpimän tyhjäkäynnin rail-paine 37–43 MPa
- jäähdytysneste vähintään 75 °C lämpimän testin ehtona
- suutintestin tyhjäkäynti-ikkuna 600–1100 rpm
- latausjännitteen vertailuohje noin 13–15 V
- DPNR-paine-eron KOEO-nollataso noin 0 kPa ilman keksittyä toleranssia
- suutinkorjausten tavallinen alue ±3,0 mm³ ja huoltoraja ±4,9 mm³

MAF- ja ahtopainearvoille ei anneta keinotekoista yhtä normaaliarvoa, vaan niitä käsitellään käyttötilan ja muiden ilmamäärä-/painehavaintojen yhteydessä.

## Testaus

- Lisätty UI-lähdekooditarkistuksia.
- Lisätty jsdom-pohjainen uuden navigaation ja Health Checkin DOM-smoke-testi.
- Lisätty IS220d:n viitearvojen ja käyttötilatulkinnan yksikkötestit.
- Release-haaran Health Check -UI-shellin syntaksi tarkistettu ennen julkaisu-CI:n ajoa.
- UI-moduulien selainelinkaari erotettu puhtaasta versionumeromoduulista, jotta Node-regressiotestit ja jsdom-testien purku eivät jätä taustalla ajavia päivityssilmukoita.
- UI-shellissä on yhteensopivuuspolku myös buildin kevennetylle WebView/DOM-savutestille.
- Live-mittarilistan suodatus ohittaa turvallisesti ympäristöt, joissa elementtikohtainen `querySelectorAll` ei ole käytettävissä.
