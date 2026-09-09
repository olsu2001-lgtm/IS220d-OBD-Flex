# Ohjattu Techstream-referenssi

Flexin Techstream-reference on edelleen oma neutraali read-only-evidenssiformaatti. Ohjattu syöttö poistaa tarpeen kirjoittaa JSONia käsin, mutta ei muuta evidenssirajaa eikä päättele CAN-osoitteita järjestelmänimistä.

## Järjestelmät

Kirjaa yksi Health Checkissä näkyvä järjestelmä per rivi:

```text
järjestelmänimi | DTC1, DTC2 | valinnainen huomio
```

Vain järjestelmänimi on pakollinen. DTC:t validoidaan samalla parserilla kuin JSON-tuonnissa. Duplikaattijärjestelmä hylätään.

## CAN-mappingit

Mapping on valinnainen ja aina eksplisiittinen. Nelikenttäinen muoto tallentuu aina `candidate`-tasolle:

```text
request | response | täsmälleen sama järjestelmänimi | evidenssiperuste
```

Jos evidenssitaso halutaan ilmaista erikseen, käytetään viittä kenttää:

```text
request | response | täsmälleen sama järjestelmänimi | candidate/verified | evidenssiperuste
```

`verified` ei synny automaattisesti järjestelmänimestä, Flexin CAN-havainnosta tai siitä, että request/response sattuu täsmäämään. Se on käyttäjän eksplisiittinen evidenssiluokitus ja vaatii kirjallisen perusteen.

Nykyinen survey-raja hyväksyy request-headerit vain väliltä `7E0–7E7`. Response-header validoidaan 11-bittiseksi kolmen heksanumeron tunnisteeksi. Mappingin järjestelmänimen täytyy olla jo järjestelmälistassa ja request→response-duplikaatti hylätään.

## Käyttö ennen kenttävalidointia

Referenssin tiedot voidaan valmistella ennen kolmen ajon ECU Survey -kenttävalidointia. Ilman tallennettua survey-snapshotia vertailutila pysyy `reference-only` / käsintarkistuksessa eikä referenssi itsessään hyväksy 0.7.0-julkaisua.

Kun survey-evidenssi myöhemmin on käytettävissä, nykyinen `compareTechstreamReference()` vertaa vain eksplisiittisiä mappingeja havaittuihin CAN-vastaajiin. Candidate-taso ei täytä 0.7.0:n verified-porttia.

## JSON-lisäasetukset

Vanha neutraali JSON-editori säilyy käyttöliittymässä lisäasetuksena. Ohjatun lomakkeen **Muodosta JSON kenttään** -painike luo ensin canonical-validatorin hyväksymän referenssin ja kopioi vasta sen JSON-editoriin. Molemmat tallennuspolut käyttävät samaa `saveTechstreamReference()`-toimintoa.

## Rajaus

Ohjattu kerros:

- ei muodosta Bluetooth- tai ECU-yhteyttä;
- ei lähetä OBD-, ELM-, CAN- tai Toyota-komentoja;
- ei käytä verkkoa;
- ei parsii Techstreamin proprietary tiedostoja tai tietokantoja;
- ei muuta Toyota-tuotantosallintalistaa;
- ei lisää write-, Active Test-, clear-, coding-, programming- tai regen-polkuja.
