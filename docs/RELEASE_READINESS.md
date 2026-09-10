# 0.8.1 release readiness

Tämä portti kokoaa jo tallennetun read-only-evidenssin yhdeksi deterministiseksi julkaisuarvioksi. Se ei hyväksy julkaisua automaattisesti eikä lähetä ajoneuvolle komentoja.

## Tilat

- `collecting-field-evidence`: kolmen yhteensopivan ajon kenttävalidointi ei ole vielä valmis.
- `field-evidence-needs-attention`: kolme ajoa on käytettävissä, mutta vähintään yksi kenttävalidoinnin ehto ei täyty.
- `awaiting-techstream`: kenttävalidointi on valmis, mutta Techstream-reference puuttuu.
- `techstream-needs-attention`: Techstream-reference on ladattu, mutta verified-mappaus puuttuu, 7E0 → 7E8 ei ole verified+observed tai verified-mappauksissa on ristiriita.
- `ready-for-release-review`: kenttäportti ja Techstreamin verified-mappaukset täsmäävät. Tämä tarkoittaa vain valmiutta manuaaliseen julkaisu-review’hun.

## Pakolliset portit

1. `field-validation`: nykyinen kolmen ajon kenttävalidointi on vihreä.
2. `techstream-reference`: Techstream-reference on ladattu.
3. `verified-mapping`: vähintään yksi CAN-mappaus on merkitty eksplisiittisesti `verified`-tasolle.
4. `engine-mapping`: moottorin `7E0 → 7E8` on sekä `verified` että Flexin aineistossa `observed`.
5. `verified-consistency`: kaikki verified-mappaukset ovat havaittuja eikä verified-ristiriitoja ole.

Candidate-mappaus ei koskaan täytä verified-porttia. Flexin vastaajat tai Techstream-järjestelmät, joille ei ole riippumatonta mappausta, jäävät varoituksiksi eivätkä synnytä CAN-mappausta automaattisesti.

## Evidenssiraja

`src/release-readiness.js` käsittelee vain jo muodostettuja yhteenveto-olioita:

- `fieldValidation`
- `techstreamComparison`

Se ei käytä transporttia, ELM-komentoja, Bluetoothia, tiedostovientiä tai verkkoa. `releaseApproved` pysyy aina arvossa `false`, ja `manualReviewRequired` pysyy arvossa `true`.

Evidence Support Bundle v1 sisältää julkaisuarvion kompaktina `releaseReadiness`-osiona. Bundle ei tämän muutoksen vuoksi ala sisältää raakaa CAN/ELM-dataa, Bluetooth-osoitetta, adapterin identiteettiä tai VIN/CALID/CVN-arvoja.

## Nykyinen 0.8.1-tilanne

Ennen oikean auton kolmea yhteensopivaa kenttäajoa odotettu tila on `collecting-field-evidence`. Testiaineiston puuttuminen ei estä muun sovelluskehityksen jatkamista, mutta se estää portin etenemisen `ready-for-release-review`-tilaan.
