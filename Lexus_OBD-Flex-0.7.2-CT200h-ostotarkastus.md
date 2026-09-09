# Lexus OBD Flex 0.7.2 — CT 200h -ostotarkastus

## Asennus ja adapteri

1. Asenna `Lexus_OBD-Flex-0.7.2-release.apk` suoraan aiemman Flex-version
   päälle. Paketti ja allekirjoitus ovat samat.
2. Salli **Lähellä olevat laitteet**. Vanhassa Androidissa BLE-haku voi
   tarvita myös sijaintioikeuden.
3. Käytä ensisijaisesti **vLinker MC+ Classic** -yhteyttä: parita Androidin
   asetuksissa ja valitse Flexissä Classic-laite. vLinker MC+ BLE käy myös.
4. Tavallinen ASCII-ELM327 käy vain, jos se käsittelee pitkät ISO-TP-
   vastaukset luotettavasti. Quicklynks FFF0/FFF6 ei tue CT:n
   valmistajakohtaista ostotestiä.

## Ennen tapaamista

- Pyydä, ettei autoa lämmitetä ennen tarkastusta. Kylmäkäynnistys on tärkeä
  EGR-/käyntihäiriöhavainto.
- Pyydä VIN, huoltohistoria ja tiedot aiemmista HV-akku-, EGR-,
  jarrutehostin-/pumppu- sekä 12 V akun korjauksista.
- Tee tavallinen nosturi-, kori-, alusta-, jarru-, rengas-, ilmastointi- ja
  nestevuototarkastus erikseen. OBD ei näe mekaanista kuntoa.

## Testin suoritus

1. Valitse Flexissä **Lexus CT 200h · ZWA10**, yhdistä adapteri ja avaa
   **Ostotesti**.
2. Kirjaa vuosimalli, mittarilukema ja tunniste. Käynnistä auto kylmänä,
   merkitse käyntiääni/ravistus, palavat varoitusvalot ja jarrupumpun ääni
   sekä käyntitiheys.
3. Laita auto READY-tilaan ja P-asentoon. Aja **CT-esitarkastus**. Se lukee
   moottorin EOBD-tiedot, readinessin, mahdollisen tuoreen koodien nollauksen,
   ZWA10-tunnisteen, HV-arvot, hybridikoodit ja kokeellisen jarru-ECU-
   kattavuuden. Älä hyväksy tavoittamatonta ECUa koodittomaksi tulokseksi.
4. Aloita automaattinen näytteenotto. Pidä auto ensin paikallaan noin
   15 sekuntia, jotta laskuri saa vähintään kolme pienen virran näytettä.
5. Kiihdytä turvallisesti ja kohtalaisesti. Tavoite on vähintään viisi
   purkunäytettä; sovellus luokittelee vaiheen HV-virrasta.
6. Hidasta regeneroivasti ilman voimakasta jarrutusta. Tavoite on vähintään
   viisi latausnäytettä. Jatka turvallista vaihtelevaa ajoa, kunnes testikesto
   on vähintään 10 minuuttia. Kuljettaja ei käytä puhelinta ajon aikana.
7. Pysäytä näytteenotto ja muodosta raportti. Flex lukee moottorin ja
   hybridiohjaimen vikakoodit uudelleen ennen raporttia. Jaa TXT tarvittaessa
   analysoitavaksi.

## Tuloksen tulkinta

- **KESKEYTÄ KAUPPA JA TUTKI**: raportissa on selvä pysäytyshavainto, kuten
  P0A80/P3000, jarrun C1391/C1252/C1253/C1256, misfire-koodi, palava
  varoitusvalo, poikkeava jarrupumppu, kylmäkäynnin ravistus/kolina tai
  toistuva voimakas HV-lohkopoikkeama.
- **TESTI KESKEN / KATTAVUUS PUUTTUU**: ZWA10-tunnistus, vikakoodivastaus,
  readiness tai jokin kolmesta HV-mittausvaiheesta puuttuu. Tämä ei ole
  hyväksyvä tulos.
- **HUOMIOITA**: selvitä raportin löydökset ja pyydä tarvittaessa Techstream-
  tai korjaamotarkastus ennen kauppaa.
- **EI SELKEÄÄ POIKKEAMAA TÄSSÄ SEULONNASSA**: testi oli kattava eikä
  määritellyissä havainnoissa ollut poikkeamaa. Tämäkään ei ole kuntotodistus.

Flexin 0,200/0,300 V lohkoerot ovat ostoseulontarajoja, eivät Lexuksen
korjausrajoja. Sovellus ei laske HV-akulle kapasiteetti- tai SOH-prosenttia.
P0A80:n varmistuminen voi vaatia pidemmän ajon ja INF-lisäkoodin. Jarru-ECU:n
7B0/7B8-luku on tutkimuskandidaatti, joten puuttuva vastaus varmistetaan
Techstream Health Checkillä.

## Turvallisuus

Testi on vain luku: ei vikakoodien poistoa, Active Testiä, pakkolatausta,
koodausta tai ECU-kirjoituksia. Älä avaa 201,6 V HV-akkua tai työskentele sen
sisällä ilman valmistajan ohjetta, koulutusta ja asianmukaisia suojaimia.
