# CNL-E pe linii: scrierea finală

Aceeași structură ca în `SPEC.md`, scrisă cu cuvinte-cheie în loc de semne și paranteze.
Promptul pentru un LLM este `prompts/kv_prompt.txt`; parserul și verificatorul sunt în `cnl_kv.py`.

```
# The report that John said yesterday he would probably send to Mary wasn't finished.
E1 fact John say E2; time=yesterday; PAST
E2 claim John send report-1; to=Mary; mode=probably; FUTURE
E3 fact _ not finish report-1; PAST

# Every student who failed the exam must repeat the course.
student-1 every; that=E1
E1 claim student-1 fail exam-1; PAST
E2 fact student-1 repeat course-1; mode=must
```

## Cele două feluri de linii

**Linie de eveniment**, una pentru fiecare verb, în ordinea verbelor din text:

```
ID TIP CINE [not] VERB [CE]; etichetă=valoare; ...; MARCAJE
```

**Linie de entitate**, înaintea evenimentelor, doar pentru un substantiv care are cuantificator,
adjective, plural sau modificator:

```
ID [CUANTIFICATOR] [ADJECTIVE]; etichetă=valoare; ...; PLURAL
```

Câmpurile se despart prin `;`. Un modificator scris pe linia entității ține de substantiv; unul
scris pe linia evenimentului ține de verb. Aceasta este toată sintaxa atașării:

```
man-1 with=telescope-1                       omul are telescopul
E1 fact Tom see man-1; PAST

E1 fact Tom see man-1; with=telescope-1; PAST    Tom a folosit telescopul
```

## Tipurile

| Cuvânt | Înseamnă |
| --- | --- |
| `fact` | vorbitorul afirmă evenimentul |
| `claim` | conținut spus, crezut, dorit, promis sau pus ca o condiție; nu e afirmat; trebuie referit de altă linie |
| `question` | întrebare directă |
| `subquestion` | întrebare în interiorul altui eveniment (*ask whether*, *know when*) |
| `order` | ordin, cerere, interogare; CINE este cel care execută, de obicei `you` |
| `interj` | interjecție, salut, mulțumire, scuză; fără CINE și fără verb |

În locul lui `CINE VERB CE`, un eveniment poate fi o formulă (`E1 fact $x^2 + 1 = 0$`) sau o
relație logică între evenimente (`E3 fact either E1 E2`, `both E1 E2`, `not E1`).

## Valorile

| Formă | Înseamnă |
| --- | --- |
| `report-1` | entitate; același id înseamnă același lucru peste tot; `dog-0` este specia |
| `John`, `New_York` | nume propriu |
| `E2` | alt eveniment |
| `I`, `you`, `we`, `this`, `that` | deictice |
| `_` | argument pe care textul nu îl spune |
| `?who`, `?when`, `?why` | necunoscuta unei întrebări |
| `5_km`, `>500_euro`, `<=5%`, `42`, `2026-10-12`, `10:30` | cantitate, număr, dată, oră |
| `$pi * radius^2$`, `"No entry"` | formulă, text literal |
| `yesterday`, `very long`, `good doctor` | proprietate sau adverb, în cuvinte simple |
| `John and Mary`, `tea-1 or coffee-1` | mai multe elemente |
| `John\|Peter` | referent ambiguu, cel preferat primul |
| `only Ana` | cu accent: `only`, `even`, `also` |

Marcajele sunt `PAST FUTURE PERF PROG HABIT POLITE EMPH`, în ultimul câmp, în această ordine.
O etichetă negată se scrie `mode=not need`.

## Mărime

Pe cele 64 de exemple: 3 671 de caractere în scrierea pe linii, 3 192 în scrierea cu paranteze,
11 545 în JSON. Promptul are 14 829 de caractere, față de 23 573 pentru cel JSON.

## Cum o folosești cu un LLM

1. `prompts/kv_prompt.txt` este mesajul de sistem (reguli + 63 de exemple). Textul de convertit
   este mesajul utilizatorului. Un text pe apel.
2. Verifică fiecare răspuns:
   ```python
   import cnl_kv, lemma_check
   errors = cnl_kv.check(answer)                      # formă și coerență
   doc = cnl_kv.parse(answer)                         # același document ca în JSON
   canonical = cnl_kv.dumps(doc)                      # scrierea canonică
   lemma = lemma_check.compare_doc(source, doc)       # cuvinte pierdute, inventate, negații
   ```
3. Dacă `errors` nu e gol, trimite mesajele înapoi modelului și cere liniile corectate. Mesajele
   spun și cum se repară greșeala.
4. Dacă `lemma["ok"]` este fals, tratează răspunsul ca suspect: retrimite-l sau dă-l unui om.

Parserul tolerează două abateri fără efect asupra sensului: un marcaj scris înaintea unei
etichete și o linie de entitate goală. `dumps(parse(x))` le aduce la forma canonică.

## Proba cu Haiku, fără fine-tuning

Două rulări cu promptul final, pe 51 de propoziții care nu sunt printre exemple. Datele sunt în
`trials/haiku_lines/`.

| Măsură | Rularea 1 | Rularea 2 |
| --- | --- | --- |
| 12 propoziții cu referință neatinsă: valide | 12 | 12 |
| aceleași: identice cu referința | 10 | 9 |
| aceleași: F1 pe sloturi | 97,4% | 97,3% |
| toate cele 36 cu referință: F1 pe sloturi | 98,2% | 97,6% |
| toate cele 51: valide la prima încercare | 49 | 48 |
| toate cele 51: valide după o reîncercare cu erorile | 51 | 51 |
| răspuns identic în ambele rulări | 33 din 51 | |

Față de proba cu JSON (`JSON.md`), unde validitatea a variat între 6 și 12 din 12 și F1 între 59%
și 94%, rezultatul este mult mai bun și mai stabil. Două lucruri s-au schimbat deodată, scrierea
și regulile din prompt, deci nu pot spune cât vine din fiecare.

Ce a greșit, cu răspuns valid:

- `PAST` pierdut sau adăugat pe un verb: *who wrote the letter* fără `PAST`, *Marta believes* cu `PAST`;
- `EMPH` pus și pe interjecție, sau uitat la *Hello, Anna!*;
- negație dublată: `I not come; mode=not can` pentru *I can't come* și `not read; freq=never`
  pentru *never read*;
- *two* pierdut din *which of the two contracts*.

Ultimele două feluri de greșeli, trei răspunsuri în total, au fost prinse de verificarea lemelor,
care nu a dat nicio alarmă falsă pe răspunsurile valide.

Limitele probei:

- Doar primele 12 propoziții sunt o măsurătoare curată. Celelalte 24 cu referință au fost văzute
  în rundele anterioare, iar regulile au fost strânse după greșelile de pe ele.
- Modelul a rulat ca subagent și a convertit toate propozițiile într-o singură sesiune. Nu am
  măsurat un apel pe propoziție prin API.
- Eșantionul este mic, iar propozițiile sunt scurte și curate. Pe paragrafe lungi, cu multe
  entități și coreferințe, mă aștept la rezultate mai slabe; nu am măsurat.
- Referințele conțin convențiile mele. La *Emma said she was tired, but she finished the report*
  ambele rulări au legat `but` de „was tired”, iar referința de „said”; ambele se pot apăra.
- O treime din propoziții au primit răspunsuri diferite în cele două rulări, de obicei prin
  diferențe mici (un marcaj, o etichetă). Pentru date de antrenare rămâne valabil filtrul
  „două redări care coincid”.

## Ce nu acoperă încă scrierea pe linii

- Decodarea cu mască de gramatică la un model local există doar pentru scrierea cu paranteze
  (`cnl_llg.lark`). `train_lora.py --field kv` antrenează pe scrierea pe linii, dar `infer.py`
  validează doar scrierea cu paranteze.
- Un cuvânt fără id pus ca valoare (`to=everyone`) trece drept proprietate; verificatorul nu îl
  poate deosebi de un adverb.
- Ordinea câmpurilor `etichetă=valoare` nu poartă sens și nu este încă fixată; scorul o ignoră.
