# Lexus OBD Flex 0.7.2 — tehotestin käyttöohje

## Mitä testi mittaa

Flex mittaa kiihtyvyysajan puhelimen GPS-nopeudesta ja arvioi auton tehoa
kiihdytykseen kuluneesta energiasta. Valmiit nopeusvälit ovat 0–100 km/h,
80–120 km/h, 0–60 mph ja 60–120 km/h. Myös oma alku- ja loppunopeus voidaan
syöttää.

GPS on ensisijainen mittauslähde. OBD-yhteys ei ole pakollinen, mutta
yhdistettynä se tallentaa GPS:n rinnalle auton ilmoittaman nopeuden,
kierrosluvun, kuormituksen ja saatavilla olevia tehoon liittyviä livearvoja.
Tehotesti käyttää Flexin nykyisiä vain lukevia OBD-pyyntöjä eikä lisää ECU-
kirjoituksia tai aktiivisia testejä.

## Ennen vetoa

1. Kiinnitä puhelin tukevasti niin, että sillä on hyvä näkyvyys taivaalle.
   Kuljettaja ei käytä puhelinta ajon aikana; anna käyttö matkustajalle, jos
   asetuksia pitää muuttaa.
2. Valitse oikea ajoneuvo ja avaa **Tehotesti**. OBD-adapterin voi yhdistää
   ensin, mutta GPS-testi toimii myös ilman adapteria.
3. Valitse nopeusväli ja syötä auton todellinen kokonaismassa: auto,
   kuljettaja, matkustajat, polttoaine ja kuorma. Massavirhe siirtyy lähes
   suoraan tehoarvioon.
4. Syötä tien kaltevuus, lämpötila ja ilmanpaine niin oikein kuin mahdollista.
   Lisäasetuksissa voi muuttaa Cd-arvoa, otsapinta-alaa,
   vierintävastuskerrointa ja voimansiirtohäviötä.
5. Käytä tasaista, kuivaa ja turvallista tietä. Vältä voimakasta tuulta ja tee
   vertailuvedot mahdollisuuksien mukaan vastakkaisiin suuntiin.

Ajoneuvo-oletukset sisältävät kevyen kuorman ja ovat vain lähtöarvoja:

| Ajoneuvo | Oletusmassa | Cd | Otsapinta-ala | Voimansiirron hyötysuhde | Virallinen vertailu |
|---|---:|---:|---:|---:|---|
| Lexus IS220d | 1700 kg | 0,27 | 2,15 m² | 85 % | 130 kW / 177 DIN hv, 0–100 km/h 8,9 s |
| Lexus CT 200h | 1470 kg | 0,29 | 2,14 m² | 88 % | 100 kW / 136 DIN hv, 0–100 km/h 10,3 s |

## Testin suoritus

1. Paina **Valmistele ja viritä testi** ja hyväksy tarkka sijaintioikeus.
2. Odota, että GPS saa nopeus- ja tarkkuustiedon. Seisontalähtö virittyy, kun
   auto on paikallaan. Rullaava testi odottaa valitun alkunopeuden ylitystä.
3. Aloita kiihdytys vasta, kun Flex kertoo testin olevan viritetty. Ajanotto
   käynnistyy ja päättyy automaattisesti. Pidä kaista, kaasun käyttö ja
   ajosuunta mahdollisimman vakaina.
4. Pysäytä turvallisesti ennen tuloksen käsittelyä. Tallenna TXT-raportti tai
   CSV, jos haluat verrata vetoa myöhemmin.

Nopeusrajoituksia on aina noudatettava. 100 tai 120 km/h loppunopeutta ei
pidä tavoitella yleisellä tiellä, jos se rikkoo rajoitusta tai vaarantaa
liikennettä. Suurten nopeuksien testit kuuluvat suljetulle alueelle.

## Tuloksen tulkinta

- **Kiihtyvyysaika** on GPS-näytteiden väliin interpoloitu valitun nopeusvälin
  aika. Soveltuvat väliajat näkyvät erikseen.
- **Keskimääräinen pyöräteho** vastaa koko mitatun välin energiamuutosta ja
  arvioituja ajovastuksia jaettuna ajalla.
- **Huippupyöräteho** on noin sekunnin tehoikkunoiden 90. persentiili. Tämä
  vähentää yksittäisen GPS-piikin vaikutusta.
- **Moottori-/järjestelmätehoarvio** korjaa huippupyörätehon syötetyllä
  voimansiirron hyötysuhteella. IS220d:ssä nimike on moottoriteho ja CT
  200h:ssa hybridijärjestelmän teho.
- **Laatupisteet** arvioivat näytetaajuutta, näytekatkoja, GPS:n vaaka- ja
  nopeustarkkuutta, ajosuunnan vaihtelua, GPS/OBD-nopeuseroa ja mahdollista
  valesijaintia. Alle 1,5 Hz mittaus tai yli kahden sekunnin näytekatko ei
  kelpaa tehovertailuun.

Tehoarvio käyttää seuraavia energioita: liike-energian muutos, renkaiden
vierintävastus, tien kaltevuus ja aerodynaaminen vastus. Todellinen tuuli,
renkaat, tien pinta, väärä massa, kaltevuus, GPS-virhe ja voimansiirron
häviöoletus voivat siirtää tulosta paljon. Flex ei korvaa dynamometrimittausta
eikä tulos ole moottorin tai hybridijärjestelmän kuntotodistus.

## Tietosuoja ja raportit

Android-silta ei lue eikä vie leveys- tai pituusastetta. Raporttiin tallentuu
monotoninen näyteaika, GPS-nopeus, korkeus, suunta, tarkkuustiedot ja
mahdollinen OBD-otos. TXT ja CSV sisältävät tuloksen laskentaan tarvittavat
asetukset sekä laatuvaroitukset. Flex säilyttää paikallisesti enintään 12
aiempaa vetoa ja vertaa vain saman ajoneuvon samaa nopeusväliä.

## Vertailuarvojen lähteet

- Lexus IS220d: https://media.lexus.co.uk/introducing-the-new-lexus-is/
- Lexus CT 200h: https://media.lexus.co.uk/introducing-the-lexus-ct-200h-2/
- Lexus CT 200h -järjestelmäteho ja kiihtyvyys:
  https://newsroom.lexus.eu/the-refreshed-ct-200h/
- Android LocationManager:
  https://developer.android.com/reference/android/location/LocationManager
- Android Location:
  https://developer.android.com/reference/android/location/Location
