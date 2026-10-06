# CNL-E v0.1: specificația limbajului

> Structura descrisă aici are trei scrieri echivalente. Cea recomandată este scrierea pe linii din
> `FORMAT.md`. Acest document folosește scrierea cu paranteze, care rămâne referința pentru
> gramatica formală și pentru decodarea cu mască.

CNL-E scrie orice text ca o listă de evenimente, câte unul pe linie, în forma fixă
`cine [not] verb ce [etichete] [MARCAJE]`. Acoperă afirmații, întrebări, ordine și interogări,
exclamații și emoții, formule matematice și text zgomotos.

Gramatica formală este `cnl.lark` (LALR(1), fără conflicte: orice text valid are o singură
analiză). Exemplele sunt în `data/examples.txt` (64 de perechi, 95 de linii) și
`data/invalid.txt` (23 de texte care trebuie respinse).

```
# Well, the report that John said yesterday he would probably send
# to Mary before Friday wasn't actually finished.
E1: John say E2 [time: yesterday] [PAST]
E2*: John send report-1 [to: Mary] [before: Friday] [mode: probably] [FUTURE]
E3: _ not finish report-1 [PAST]
```

## Forma unei linii

```
E2*: John send report-1 [to: Mary] [before: Friday] [mode: probably] [FUTURE]
```

| Bucată | Ce este | Regulă |
| --- | --- | --- |
| `E2` | eticheta evenimentului | E1, E2, ... în ordinea liniilor |
| `*` | tipul liniei | vezi mai jos |
| `John` | cine | un termen |
| `send` | verbul | o singură lemă; `not` stă imediat înaintea ei |
| `report-1` | ce | cel mult un complement direct |
| `[to: Mary]` | etichetă pe verb | oricâte, în ordinea din text |
| `[FUTURE]` | marcaj gramatical | set închis, mereu la sfârșit |

### Ce poate umple un loc

| Formă | Înseamnă |
| --- | --- |
| `report-1` | substantiv comun, entitatea numărul 1 cu acest nume |
| `report-1+` | plural: un grup de rapoarte |
| `dog-0` | specia sau materia în general, nu un exemplar |
| `John`, `New_York`, `John-2` | nume propriu |
| `I`, `you`, `we`, `this`, `that` | deictice; nu se pot rezolva din text |
| `E2` | alt eveniment, folosit ca argument |
| `_` | argument care nu apare în text |
| `John\|Peter` | referent ambiguu; primul este cel preferat |
| `?who`, `?when`, `?why` | necunoscuta unei întrebări |
| `"No entry"` | text literal, păstrat ca atare |
| `$pi * radius^2$` | formulă |
| `5_km`, `>500_euro`, `<=5%`, `~300_km` | cantitate, cu comparație opțională |
| `2026-10-12`, `10:30` | dată, oră |

Înaintea substantivului pot sta un cuantificator (`every`, `all`, `each`, `some`, `any`, `no`,
`most`, `many`, `few`, `several`, `half`, `not_every`, `not_all`, `not_many`, `3`, `>3`,
`?which`, `?how_many`, `?how_much`) și adjective. Doi termeni se leagă cu `and` sau `or`.
Înaintea unui termen pot sta `only`, `even`, `also`. După verb poate sta și o proprietate fără
id: `be very long`, `be good doctor`, `be tall and strong`.

## Tipurile de linie

| Scriere | Tip | Când se folosește | Exemplu |
| --- | --- | --- | --- |
| `E1:` | fapt | vorbitorul afirmă evenimentul | `E1: server-1 crash [PAST]` |
| `E1*:` | neafirmat | conținut spus, dorit, promis, cerut sau pus ca o condiție | `E2*: John leave` |
| `E1?:` | întrebare directă | cu `?variabilă` cere o valoare; fără, cere da sau nu | `E1?: ?who send report-1` |
| `E1*?:` | întrebare inclusă | după *ask whether*, *know when*, *wonder who* | `E2*?: train-1 leave [time: ?when]` |
| `E1!:` | ordin, cerere, interogare | subiectul este cel care execută, de obicei `you` | `E1!: you close door-1` |
| `E1^:` | expresiv | interjecție, salut, mulțumire, scuză; nu are verb | `E1^: thanks [for: help-1]` |

Exclamația nu este un tip separat: este un fapt cu `[EMPH]`. Dorința (*if only*, *may you*) este
un fapt cu `[mode: wish]`. O linie cu `*` trebuie referită de altă linie. Un verb factiv
(*know*, *regret*) are drept conținut un fapt, deci linia referită rămâne fără `*`.

## Regulile

Regulile 2, 4, 7, 8 și 13 sunt impuse complet de gramatică și de validator, la fel și locul lui
`not` din regula 6. Regulile 1, 3 și 5 sunt impuse doar parțial: după verb, un cuvânt fără id
este citit ca proprietate, deci `John want leave` trece ca formă. Celelalte sunt convenții de
scriere, pe care le poate verifica doar un set de test.

1. **O linie, un eveniment, un verb.** Două verbe înseamnă două linii.
2. **Ordine fixă:** cine, `not`, verb, ce, etichete, marcaje.
3. **Fiecare substantiv comun poartă un id.** Același id înseamnă aceeași entitate în tot
   paragraful; două rapoarte diferite sunt `report-1` și `report-2`.
4. **Fără pronume de persoana a treia, articole sau auxiliare.** Pronumele devine referentul
   său, articolul dispare, auxiliarul devine marcaj.
5. **Propozițiile nu se imbrică.** O subordonată este o linie separată, referită prin etichetă:
   `John say E2`.
6. **`not` stă imediat înaintea verbului pe care îl neagă.** Modalul are scope peste verbul
   negat: `not open [mode: must]` înseamnă „trebuie să nu deschizi”. Negarea modalului se scrie
   în etichetă: `open [mode: not need]`. Cuvintele negative (*never*, *nobody*, *no* + substantiv,
   *without*) își păstrează lema și nu primesc un `not` în plus: `nobody-1 answer`,
   `restart database-1 [freq: never]`.
7. **Acolade pentru substantiv, paranteze drepte pentru verb.** `man-1{with: telescope-1}` este
   omul cu telescop; `see man-1 [with: telescope-1]` este văzutul prin telescop.
8. **Marcajele sunt un set închis, stau ultimele și au ordine fixă:** `PAST`, `FUTURE`, `PERF`,
   `PROG`, `HABIT`, `POLITE`, `EMPH`. Prezentul nu se marchează.
9. **Eticheta este prepoziția sau conectorul din text:** `to`, `before`, `if`, `although`,
   `than`, `but`. Când textul nu are una, se folosește o etichetă de bază: `time`, `place`,
   `manner`, `mode`, `degree`, `cause`, `purpose`, `freq`, `duration`. Eticheta unui conector stă
   pe propoziția principală și arată spre subordonată.
10. **Pasivul devine activ.** Agentul din *by* trece pe locul întâi; dacă lipsește, locul întâi
    este `_`.
11. **Modificatorul restrictiv rămâne pe substantiv, cel nerestrictiv devine fapt separat.**
    `every student-1{that: E1}` restrânge mulțimea; *the meeting, which started late* dă două fapte.
12. **Cuvintele sunt lemele din text, cu litere mici.** Un adverb aflat chiar înaintea unui adjectiv
    rămâne lângă el (`be so happy`); `degree` se folosește doar pentru un verb sau o interjecție. Expresiile din mai multe cuvinte se
    leagă cu `_` (`give_up`, `a_lot`). CNL-ul adaugă doar etichetele de bază, marcajele și `_`.
13. **Numerotare canonică.** Evenimentele sunt E1, E2, ... în ordinea liniilor; id-urile unui
    substantiv încep de la 1 și cresc cu 1 în ordinea primei apariții. `canon.py` o repară automat.
14. **Evenimentele apar în ordinea în care apar verbele lor în text.** O linie logică
    (`either E1 or E2`) vine imediat după ultimul ei operand.

## Curățare: ce se întâmplă cu fiecare lucru din text

| În text | În CNL |
| --- | --- |
| *um*, *uh*, *well*, *like*, *you know*, *I mean*, *basically*, *actually*, *honestly* | eliminat |
| reveniri și repetiții (*I... I mean, we*) | rămâne doar varianta finală |
| articole (*a*, *an*, *the*) și demonstrative înaintea unui substantiv (*this cake*) | eliminat; identitatea stă în id |
| auxiliare: *did*, *was*, *will*, *has* | marcaj: `[PAST]`, `[FUTURE]`, `[PERF]`, `[PROG]` |
| *he*, *she*, *it*, *they* | referentul; doi candidați despărțiți prin bară dacă e ambiguu; `_` dacă e impersonal (*it rains*); `she-1` dacă textul nu spune la cine se referă |
| *who*, *which*, *that* relative | id-ul substantivului, repetat în linia nouă |
| *please*, *could you* | `[POLITE]` |
| semnul exclamării, *really, really* | `[EMPH]`, o singură dată, pe evenimentul principal al propoziției |
| *wow*, *ouch*, *damn*, *thanks*, *sorry*, *hello* | linie expresivă: `E1^: wow` |
| vocativ (*Good morning, Mary!*) | `[to: Mary]` |
| *probably*, *must*, *can*, *maybe* | `[mode: ...]` |
| matematică spusă în cuvinte (*x squared plus one*) | formulă: `$x^2 + 1$` |
| citat sau text care nu trebuie atins | șir între ghilimele |

## Ce garantează validatorul și ce nu

`cnl_check.py` garantează forma și coerența internă, nu sensul.

| Verificare | Cine o face | Exemplu respins |
| --- | --- | --- |
| forma liniei, ordinea locurilor, marcajele la sfârșit | gramatica | `E1: John send report-1 [PAST] [to: Mary]` |
| locul negației | gramatica | `E1: John send not report-1` |
| formule bine formate | gramatica | `E1: $x + * 2 = 3$` |
| orice eveniment referit există; fără autoreferință | validatorul | `E1: John say E2`, fără linia E2 |
| orice linie cu `*` este referită | validatorul | `E2*: Mary stay`, nereferită |
| `?variabilă` doar pe linii de întrebare | validatorul | `E1: ?who leave [PAST]` |
| fără articole, pronume, auxiliare | validatorul | `E1: He send the report-1` |
| numerotare canonică, ordinea marcajelor | validatorul | `E1: John send report-3 [PAST]` |

`lemma_check.py` adaugă verificarea față de textul sursă: cuvinte de conținut pierdute sau
inventate și numărul de negații. Rămân neverificate atașarea, scope-ul și consecvența id-urilor
(dacă `report-1` din două linii este cu adevărat același raport).

## Limite cunoscute

| Limită | Ce se întâmplă acum |
| --- | --- |
| Scope între cuantificatori (*Every student read a book*) | rămâne ordinea din text; ambiguitatea nu este marcată |
| Fragmente și elipsă (*No idea why.*) | trebuie reconstruite de model sau lăsate ca șir între ghilimele |
| Întrebări alternative (*tea or coffee?*) și de confirmare (*..., didn't he?*) | arată la fel ca o întrebare cu da sau nu |
| Pasiv fără agent cu citire de stare (*the window was broken*) | devine mereu `_ break window-1`, deși poate descrie o stare |
| `and` colectiv sau distributiv (*John and Mary lifted the piano*) | nu se distinge |
| Ordinea în timp între evenimente | doar prin marcaje și etichete (`before`, `after`, `PERF`); nu există o axă a timpului |
| Ironie, întrebări retorice | nu sunt reprezentate |
| Alte limbi decât engleza | cuvintele acceptă doar litere ASCII; pentru română trebuie adăugate diacriticele în `WORD`, `NOUN` și `NAME` |

## Decizii deschise

De luat înainte de a genera date de antrenare:

- [ ] Etichetele de bază (`time`, `place`, `manner`...) rămân o listă deschisă sau devin set închis în gramatică?
- [ ] Pasivul fără agent: mereu `_ verb obiect`, sau se admite și `obiect be participiu`?
- [ ] Vorbirea directă: se analizează în evenimente sau se păstrează ca șir?
- [ ] Limba țintă: doar engleză, sau și română de la început?
