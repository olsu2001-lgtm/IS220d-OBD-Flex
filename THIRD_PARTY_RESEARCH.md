# Flex 0.6.8 · GitHub-tutkimuksen hyödyntäminen

Flex 0.6.7:n profiili-, transaktio- ja replay-rakenne sekä 0.6.8:n adaptiivinen
pollaus- ja laadunseuranta on toteutettu itsenäisesti Flexin omaan
lähdekoodiin. Alla olevia projekteja käytettiin arkkitehtuurin, testitapojen
ja yhteensopivuusrajojen tutkimiseen.

| Projekti | Lisenssi | Flexissä hyödynnetty idea | Lähdekoodia Flexissä |
|---|---|---|---|
| BETSY | MIT | ECU-otsakkeen ja pyynnön atominen käsittely, kielteisen vastauksen ja replayn erottaminen | Ei kopioitu |
| ObdMetrics / ObdGraphs | Apache-2.0 | deklaratiivinen profiili, lähdekohtaiset prioriteetit, vasteeseen mukautuva ajoitus ja mock-testaus | Ei kopioitu |
| ELM327-emulator | CC BY-NC-SA 4.0 | auton ulkopuolisten häiriötilojen testaus | Emulaattoria ei niputeta; mukana on vain Flexin itse kirjoittama yhteensopivuusskenaario |
| universal-elm327-logger | GPL-3.0 | eräpäiväjono, saman lähteen mittarien fan-out, mittauskatolaskuri, multi-ECU-pollaus ja replay-testien käyttäytymisvertailu | Ei kopioitu |
| AndrOBD | GPL-3.0 | Android-kuljetusten, demotilan ja DTC-näkymän käyttäytymisvertailu | Ei kopioitu |
| RealDash-extras | Unlicense | profiilikenttien, yksiköiden ja muunnosmetadatan vertailu | Ajoneuvodata ei kopioitu |
| Nordic Android BLE Library | BSD-3-Clause | GATT-jonon ja MTU-/uudelleenyhdistysmallien vertailu | Ei lisätty riippuvuudeksi |

Flexin ajoneuvokohtaiset pyynnöt ja kaavat perustuvat projektissa jo ennen
0.6.7-versiota varmennettuun IS220d/2AD-FHV-aineistoon. 0.6.8 ei lisää uusia
ajoneuvopyyntöjä. Muiden Toyota- tai
Lexus-mallien PID-listoja tai kirjoituskomentoja ei ole tuotu sovellukseen.

Tutkitut projektit:

- https://github.com/alrighdee/BETSY
- https://github.com/tzebrowski/ObdMetrics
- https://github.com/tzebrowski/ObdGraphs
- https://github.com/Ircama/ELM327-emulator
- https://github.com/bsdate-cc/universal-elm327-logger
- https://github.com/fr3ts0n/AndrOBD
- https://github.com/janimm/RealDash-extras
- https://github.com/NordicSemiconductor/Android-BLE-Library
