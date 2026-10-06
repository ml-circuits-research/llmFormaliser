# CNL-E ca JSON, pentru un LLM găzduit

Aceeași structură ca în `SPEC.md`, cu chei predefinite în loc de paranteze. Este suficientă:
toate cele 64 de exemple se convertesc în JSON fără pierdere de sens și trec verificatorul.

```json
{"entities": [{"id": "report-1", "adj": ["old"], "mods": [{"label": "on", "value": "sale-1"}]},
              {"id": "sale-1", "plural": true}],
 "events": [{"id": "E1", "who": "John", "verb": "say", "what": "E2",
             "tags": [{"label": "time", "value": "yesterday"}], "flags": ["PAST"]},
            {"id": "E2", "type": "unasserted", "who": "John", "verb": "send", "what": "report-1",
             "tags": [{"label": "to", "value": "Mary"}, {"label": "mode", "value": "probably"}],
             "flags": ["FUTURE"]},
            {"id": "E3", "who": "_", "not": true, "verb": "finish", "what": "report-1",
             "flags": ["PAST"]}]}
```

## Cheile

Un eveniment pentru fiecare verb:

| Cheie | Valoare | Obligatorie |
| --- | --- | --- |
| `id` | `"E1"`, `"E2"`, ... în ordine | da |
| `type` | `unasserted`, `question`, `embedded_question`, `directive`, `expressive`; lipsă înseamnă fapt | nu |
| `who` | subiectul; `"_"` dacă textul nu îl spune | cu `verb` |
| `not` | `true` dacă verbul e negat | nu |
| `verb` | o lemă | una dintre `verb`, `formula`, `logic` |
| `what` | complementul direct sau proprietatea de după *be* | nu |
| `tags` | ce ține de VERB: listă de `{"label", "value"}` | nu |
| `flags` | din `PAST FUTURE PERF PROG HABIT POLITE EMPH`, în această ordine | nu |
| `formula` | enunț matematic în ASCII, fără `$` | în loc de `verb` |
| `logic` + `args` | `either`, `both`, `not` peste evenimente | în loc de `verb` |

O entitate pentru fiecare substantiv comun care are ceva de spus despre el:

| Cheie | Valoare |
| --- | --- |
| `id` | lemă + număr: `"report-1"`; `"dog-0"` este specia |
| `quant` | `every`, `no`, `most`, ..., un număr, `?which`, `?how_many` |
| `adj` | cuvintele dinaintea substantivului, în ordine |
| `plural` | `true` pentru un grup |
| `mods` | ce ține de SUBSTANTIV: listă de `{"label", "value"}` |

O valoare este un șir (`"report-1"`, `"John"`, `"E2"`, `"_"`, `"?who"`, `"5_km"`, `"yesterday"`)
sau, pentru mai multe elemente, `{"join": "and" | "or" | "alt", "items": [...]}`, unde `alt`
înseamnă referent ambiguu, cu cel preferat primul. Cu accent: `{"focus": "only", "items": ["Ana"]}`.

Atașarea nu mai are sintaxă proprie: un modificator pus în `mods` ține de substantiv, unul pus
în `tags` ține de verb.

## Ce câștigi și ce plătești

| | CNL-E cu paranteze | JSON |
| --- | --- | --- |
| formă garantată la un model găzduit | doar prin validare și reîncercare | prin schema JSON, dacă API-ul impune scheme (`cnl_schema.json`) |
| atașare | `{}` față de `[]` | locul în care stă modificatorul |
| lungimea ieșirii | 1× | 3,6× în caractere pe cele 64 de exemple |
| verificarea lemelor, antrenare, evaluare | există | încă nu; lipsește convertorul JSON → CNL-E |

Lungimea contează: mai multe caractere generate înseamnă cost și timp mai mari la fiecare apel.

## Cum îl folosești

1. `prompts/json_prompt.txt` este mesajul de sistem (reguli + 63 de exemple, 23 517 caractere).
   Textul de convertit este mesajul utilizatorului. Un text pe apel.
2. Dacă API-ul modelului impune o schemă JSON, dă-i `cnl_schema.json`. Schema folosește `anyOf`
   și `$ref`; verifică dacă API-ul tău le acceptă.
3. Verifică fiecare răspuns:
   ```python
   import cnl_json
   doc = cnl_json.parse_answer(text_from_model)   # tolerează ```json și valori implicite scrise explicit
   errors = cnl_json.check(doc)
   ```
4. Dacă `errors` nu e gol, trimite lista înapoi modelului și cere JSON-ul corectat. După două
   încercări eșuate, întoarce un eșec explicit.

## Proba cu Haiku, fără fine-tuning

Am rulat promptul de două ori pe 48 de propoziții pe care modelul nu le-a văzut ca exemple.
Datele sunt în `trials/haiku_json/`.

| Set | Rularea 1 | Rularea 2 |
| --- | --- | --- |
| 12 propoziții noi cu referință: JSON valid | 6 din 12 | 12 din 12 |
| aceleași: identic cu referința | 1 din 12 | 6 din 12 |
| aceleași: F1 pe sloturi | 59,5% | 93,5% |
| 15 propoziții noi fără referință: JSON valid | 11 din 15 | 13 din 15 |
| răspuns identic în ambele rulări, toate propozițiile | 15 din 47 | |

Concluzia: doar cu prompt, Haiku nu este de încredere pe acest limbaj. Poate ajunge la 93% F1,
dar a doua rulare, cu același prompt, a dat 59%, iar cele două rulări au căzut de acord pe o
treime din propoziții.

Greșeli de formă, pe care verificatorul le prinde:

- `plural` pus pe eveniment în loc de entitate (cea mai frecventă în rularea 1);
- semne `$` în `formula`;
- pronume lăsat nerezolvat (*it*, *she*) și auxiliar pus ca verb.

Greșeli de sens în JSON valid, pe care verificatorul nu le prinde:

- pasiv netrecut la activ: *files that were modified* cu `file-1` ca subiect, în ambele rulări;
- `PAST` pierdut pe un verb la trecut; o propoziție cu *because* marcată ca neafirmată;
- la o probă anterioară, cu un prompt mai scurt: negația pierdută în *Why didn't you call me
  yesterday?*, în ambele rulări, și direcția lui *although* inversată.

Limitele probei:

- Modelul a rulat ca subagent și a convertit toate cele 48 de propoziții într-o singură sesiune.
  Un apel pe propoziție, cu schemă impusă și cu reîncercare la eroare, ar elimina probabil
  greșelile de formă. Nu am măsurat asta.
- 12 propoziții cu referință este un eșantion mic; cifrele arată ordinul de mărime, nu o rată.
- Referința conține convențiile mele; unele diferențe sunt alegeri apărabile, nu greșeli
  (de exemplu `really` ca grad separat în loc de `really delicious`).

Proba a găsit și trei goluri în limbaj, acum închise în `SPEC.md` și în prompturi: unde se pune
`EMPH`, ce devine un pronume fără referent în text (`she-1`) și pe ce propoziție stă eticheta
unui conector.
