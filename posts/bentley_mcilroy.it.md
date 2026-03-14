Di recente ho rilasciato su GitHub un'implementazione in **C++17** dell'algoritmo di compressione lossless di Bentley e McIlroy (disponibile [qui](https://github.com/Angelido/bentley_mcilroy)) [1].
Approfittando dell'occasione, mi piacerebbe parlare un po' di questo algoritmo: semplice nel suo nucleo, ma sorprendentemente elegante nelle idee che lo motivano.

---

## Usare solo lunghe stringhe comuni

L'articolo che introduce l'algoritmo è stato pubblicato nel 1999 con il titolo *Data Compression Using Long Common Strings* [2]. L'idea alla base nasce da un'osservazione molto precisa: i metodi di compressione classici basati su **finestra scorrevole** — in particolare le varianti di [LZ77](https://it.wikipedia.org/wiki/LZ77_e_LZ78) [3] — cercano ripetizioni solo all'interno di una finestra di pochi kilobyte. Quando due stringhe identiche si trovano molto lontane nel testo, queste tecniche finiscono per trattarle come completamente indipendenti, perdendo un'importante opportunità di compressione.

Gli autori illustrano questo limite con un esperimento piuttosto elegante: prendono la *Costituzione degli Stati Uniti* e la *Bibbia di Re Giacomo*, e comprimono sia il testo originale sia la versione concatenata con sé stessa. Con `gzip` (una delle implementazioni più diffuse basate su LZ77), il file raddoppiato viene compresso a **quasi il doppio della dimensione del file originale**. Il motivo è semplice: la finestra di contesto è troppo piccola per accorgersi che la seconda metà del file è quasi identica alla prima; di conseguenza, viene compressa quasi da zero, come se fosse testo nuovo.

Gli autori commentano questo fenomeno con una frase piuttosto diretta:

> *"Sliding windows do not find repeated strings that occur far apart in the input text. A major opportunity has been missed."*  
> — Bentley & McIlroy, 1999

La proposta degli autori è quindi quella di adottare un approccio diverso: non usare una finestra di contesto di dimensione fissa, ma considerare **l'intero testo come contesto**. Questo introduce però un problema evidente di efficienza: cercare ogni ripetizione sull'intero testo richiederebbe tempi e memoria inaccettabili. 

Il compromesso proposto è elegante: invece di cercare *tutte* le stringhe ripetute, ci si concentra solo su quelle **sufficientemente lunghe**. Si accetta di perdere alcune opportunità di compressione pur di garantire:

- tempi di esecuzione ragionevoli
- uso della memoria contenuto
- l'intero testo come contesto di ricerca

Nella pratica si lavora con **blocchi di dimensione** $b$ e si mantiene una struttura dati compatta che memorizza le *fingerprint* di tutti i blocchi disgiunti incontrati finora. Se il file ha lunghezza $n$, vengono memorizzate circa $n/b$ fingerprint — una riduzione drastica rispetto alle $n$ possibili sottostringhe del testo.

La scelta di $b$ introduce naturalmente un compromesso: un valore piccolo può migliorare la qualità della compressione, ma aumenta memoria e tempo di esecuzione; un valore grande riduce il costo computazionale, ma rischia di ignorare molte ripetizioni brevi. 

Nelle prossime sezioni entreremo nel dettaglio dei componenti principali dell'algoritmo, delle proprietà che garantisce e delle sue complessità computazionali. Per aumentare la comprensibilità ci aiuteremo con esempi, che mostrano il funzionamento delle componenti principali. Chiuderemo poi il post parlando degli utilizzi odierni di questo algoritmo.

---

## L'algoritmo

Iniziamo dunque vedendo come funziona l'algoritmo. Questo scansiona il file da comprimere una sola volta, da sinistra a destra, mantenendo in memoria una struttura dati compatta aggiornata incrementalmente. L'unico parametro è $b$, la dimensione dei blocchi in byte. Per ogni posizione $i$ nel testo, l'algoritmo calcola il fingerprint del blocco $a[i-b+1 \ldots i]$ e:

- se $i$ è un multiplo di $b$, memorizza il fingerprint nella tabella hash (`store`);
- in ogni caso, cerca se quel fingerprint è già presente in tabella (`checkformatch`).

Lo pseudocodice originale è il seguente:

```python
fp = fingerprint(a[0:b-1])
hash_table = {}
for i in range(b, n):
    if i % b == 0:
        store(fp, i)               # memorizza il fingerprint del blocco canonico
    fp = roll(fp, a[i-b], a[i])   # aggiorna la finestra
    checkformatch(fp, i)           # cerca un match nella hash table
```

Dunque, i due elementi fondamentali sono la *fingerprint* — che identifica ogni blocco in modo compatto — e la *tabella hash* — che memorizza solo i blocchi disgiunti e consente di cercare corrispondenze in tempo costante.
Andiamo quindi ad analizzarli entrambi, per poi vedere come vengono gestiti i match.

### Il fingerprint di Rabin–Karp

Iniziamo dal meccanismo centrale: il fingerprint. Si tratta di un valore numerico associato a ogni blocco di $b$ caratteri consecutivi, e funge da codice identificativo del blocco. L'idea è quella di associare a ogni blocco un valore numerico tale che blocchi uguali abbiano sempre lo stesso fingerprint, mentre blocchi distinti lo abbiano diverso con alta probabilità.

Nel loro algoritmo di compressione, Bentley e McIlroy decidono di utilizzare il *fingerprint di Rabin–Karp* [4]. La loro scelta cade su questo algoritmo per diversi motivi. Il primo è ovviamente la semplicità della sua definizione. L'idea è interpretare una sequenza di $b$ caratteri come i coefficienti di un polinomio, e calcolarne il valore modulo un numero primo grande $p$. La formula è la seguente:

$$
\begin{equation}
F(a_i, \ldots, a_{i+b-1}) = \left( \sum_{j=0}^{b-1} a_{i+j} \cdot B^{b-1-j} \right) \bmod p
\end{equation}
$$

dove $B$ è una base intera scelta opportunamente — tipicamente un primo leggermente superiore alla dimensione dell'alfabeto.

Ma il motivo principale per cui questo metodo è stato scelto è la proprietà cruciale di cui il fingerprint di Rabin–Karp gode: quella di poter essere **aggiornato in $O(1)$** quando la finestra scorre di un simbolo, senza ricalcolare il polinomio da capo.. Questa operazione è chiamata `roll` e funziona in maniera intuitiva: si parte dal valore del blocco corrente e si aggiorna rimuovendo il contributo del simbolo uscente e aggiungendo quello del simbolo entrante. La formula è la seguente:

$$
\begin{equation}
F' = \bigl(F - a_{\text{out}} \cdot B^{b-1}\bigr) \cdot B + a_{\text{in}} \bmod p
\end{equation}
$$

Questa formula è la ragione per cui l'algoritmo è efficiente: scorrere l'intero input e calcolare il fingerprint per ogni blocco richiede $O(n)$ operazioni di roll, ciascuna $O(1)$.

:::example
Vediamo un esempio di come funziona il fingerprint di Rabin–Karp e in particolare l'operazione di *roll*. Per semplicità prendiamo la base $B = 10$, la dimensione del blocco $b = 3$ e lavoriamo con cifre decimali invece che con byte. Consideriamo l'array di interi `[4, 7, 2, 9]`.
 
La finestra iniziale di dimensione $b$ è `[4, 7, 2]`: usando l'Equazione (1) possiamo dunque calcolarne il fingerprint come
 
$$
4 \cdot 10^2 + 7 \cdot 10 + 2 = 472
$$
 
Dopo aver calcolato il fingerprint per questa finestra, siamo pronti a farla scorrere di un passo: esce il `4` ed entra il `9`. Per calcolare il nuovo fingerprint applichiamo il roll dell'Equazione (2):
 
$$
F' = (472 - 4 \cdot 10^2) \cdot 10 + 9 = 72 \cdot 10 + 9 = 729
$$
 
Il risultato è $729 = 7 \cdot 10^2 + 2 \cdot 10 + 9$ — esattamente il fingerprint di `[7, 2, 9]`, calcolato con una sottrazione, una moltiplicazione e una somma.
:::

Prima di chiudere questa sezione, è importante sottolineare un'altra proprietà importante del fingerprint di Rabin–Karp: due stringhe distinte hanno fingerprint diverso con alta probabilità. Con un fingerprint a 32 bit la probabilità di collisione è circa $2^{-32}$ — sufficientemente bassa per un uso pratico. Dunque, se due blocchi hanno lo stesso fingerprint è altamente probabile che siano uguali. Questo non toglie il fatto che bisogna verificare in ogni caso se i due blocchi siano effettivamente uguali confrontandoli direttamente, ma garantisce di avere un numero minimo, se non nullo, di confronti inutili — quelli in cui i fingerprint coincidono ma i blocchi no.

### La struttura dati

Rileggendo lo pseudocodice sopra si nota come sia necessaria una struttura dati che gestisce due operazioni: `store` e `checkformatch`. Quella che meglio si adatta a queste operazioni è evidentemente una *tabella hash*, che sarà dunque la nostra struttura dati di riferimento. Andiamo ora dunque a vedere in cosa consistono e come vengono effettuate le due operazioni.

#### Store

La prima operazione è lo store, che serve a popolare la tabella hash. Come già anticipato, questa operazione viene invocata solo sui *blocchi canonici* — quelli che iniziano a posizioni multiple di $b$: il primo blocco è $a[1 \ldots b]$, il secondo è $a[b+1 \ldots 2b]$, e così via. In pratica viene invocata su tutti i blocchi disgiunti di dimensione $b$. Limitarsi ai soli blocchi disgiunti è la scelta che tiene la memoria sotto controllo: in un file di $n$ byte si memorizzano circa $n/b$ entry.

Per ciascun blocco su cui viene effettuato lo store, viene inserita una coppia di valori nella tabella hash: il fingerprint del blocco calcolato con la formula di Rabin–Karp, e un puntatore all'inizio del blocco. Per determinare dove inserire questa coppia si eseguono operazioni aritmetiche sul fingerprint, in modo che fingerprint uguali restituiscano la stessa posizione nella tabella. Le eventuali collisioni possono essere gestite in vari modi classici, dalle liste concatenate all'open addressing.

Vale la pena notare che, sapendo di avere al più $n/b$ entry, una tabella hash di dimensione compresa tra $n/b$ e $2n/b$ garantisce una probabilità di collisione trascurabile.

#### Checkformatch

La seconda operazione è *checkformatch*, che serve a individuare eventuali match. A differenza della prima, viene invocata a ogni passo della scansione — non solo sui blocchi canonici, ma su tutti i blocchi di dimensione $b$. Per ogni blocco corrente, si calcola il suo fingerprint, lo si usa per sondare la tabella hash, e se la posizione corrispondente contiene un'entry con lo *stesso* fingerprint, si ha un *hit*.

L'eleganza della scelta sta qui: il confronto diretto tra stringhe — potenzialmente costoso quando il blocco candidato si trova lontano nel file — viene effettuato *solo* in caso di hit. La probabilità che due blocchi distinti abbiano lo stesso fingerprint è trascurabile, quindi quasi tutti i confronti costosi vengono evitati.

Se il confronto diretto conferma il match, l'algoritmo estende la corrispondenza sia in avanti che all'indietro:

- **Estensione in avanti** — i due puntatori avanzano insieme finché i simboli coincidono, senza limite di lunghezza.
- **Estensione all'indietro** — i puntatori retrocedono, ma al massimo di $b-1$ simboli. Il limite non è arbitrario: se esistessero $b$ o più simboli uguali a sinistra, esisterebbe almeno un blocco canonico corrispondente al match mancato, il quale avrebbe già lo stesso fingerprint e sarebbe già in tabella — il match sarebbe stato trovato in un'iterazione precedente.

### Codifica dell'output

Al termine del processo di scansione, ogni porzione del testo è codificata in uno di due modi:

- **Literal** — il byte viene emesso così com'è, perché non è stato coinvolto in nessun match.
- **Match** — viene emessa la coppia $\langle \text{pos},\, \text{len} \rangle$, dove $\text{pos}$ è la posizione nel testo originale in cui inizia la stringa corrispondente e $\text{len}$ è il numero di byte condivisi.

L'output finale è dunque un insieme di literal e match. L'idea è che più match lunghi sono presenti nell'output, migliore sarà stata la compressione.

:::example
Consideriamo il seguente testo e supponiamo che la dimensione del blocco sia $b = 10$:

```txt
the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog
```

È evidente come questo testo sia la concatenazione due volte della stessa frase. Ci aspettiamo che il nostro compressore individui questa ripetizione e la esprima come match. 

Quello che accade nella pratica è che durante la scansione dei primi 44 caratteri l'algoritmo non trova ripetizioni all'indietro e tutti i caratteri vengono emessi come literal. Quando l'algoritmo raggiunge il 45° carattere, il blocco corrente coincide con uno già memorizzato: tramite estensione in avanti, l'algoritmo individua che l'intera seconda metà del testo è una ripetizione e viene codificata come un unico match.

```txt
the quick brown fox jumps over the lazy dog <1, 44>
```

Il token `<1, 44>` significa: *vai alla posizione 1, copia 44 simboli*.
:::

:::example
Consideriamo ora un testo meno regolare, con dimensione del blocco $b = 3$:

```txt
xyzabcdyzabcdplxxyzabq
```

Andiamo a vedere passo per passo quello che fa l'algoritmo.

- Nelle prime 9 posizioni non troviamo match. L'algoritmo salva nella tabella hash i tre blocchi canonici `xyz`, `abc` e `dyz`, e durante la scansione dei blocchi non canonici non trova ripetizioni.
- Alla posizione dieci il blocco corrente è `abc`, che viene individuato nella tabella hash come hit: c'è un match. Per determinare l'estensione del match l'algoritmo scorre prima all'indietro, dove vengono trovati altri due caratteri in comune, allargando il match a `yzabc`, e poi in avanti, dove viene trovato un ulteriore carattere, portando il match a `yzabcd`. La posizione di inizio match è 2 (in numerazione 1-based) e la lunghezza è 6. Il match rilasciato è dunque `<2, 6>`, che sostituisce il blocco `yzabcd` a partire dalla posizione 8. I primi 7 caratteri vengono emessi come literal.
- L'algoritmo continua la scansione senza trovare match fino a quando non incontra il blocco `xyz`, già presente in tabella hash. Controlla all'indietro, senza trovare nuovi caratteri in comune, e poi in avanti, dove trova due caratteri, portando il match a `xyzab`. Il match rilasciato è `<1, 5>`.
- A questo punto rimane solo la lettera `q`, che viene emessa come literal.

L'output finale è:

```txt
xyzabcd <2,6> plx <1,5> q
```

Verifichiamo sia corretto decodificando ogni token:

| Token | Espansione |
|-------|-----------|
| `xyzabcd` | 7 literal |
| `<2, 6>` | pos. 2, 6 simboli → `yzabcd` |
| `plx` | 3 literal |
| `<1, 5>` | pos. 1, 5 simboli → `xyzab` |
| `q` | 1 literal |

Ricostruito: `xyzabcd` + `yzabcd` + `plx` + `xyzab` + `q` = `xyzabcdyzabcdplxxyzabq` ✓
:::

---

## Proprietà e Complessità

A questo punto ci chiediamo quali sono le proprietà che rendono interessante l'algoritmo descritto sopra, e soprattutto quali possono essere i vantaggi di usarlo rispetto ad algoritmi più potenti, per esempio quelli basati su LZ77. 

La prima perplessità che qualcuno potrebbe avere è: utilizzando un blocco $b$ grande, non vengono persi troppi match? La domanda è legittima, ma Bentley e McIlroy dimostrano che tutti i match di lunghezza **maggiore o uguale** a $2b-1$ vengono correttamente individuati. Il ragionamento è il seguente: match più corti di $b$ non vengono mai trovati; match di lunghezza compresa tra $b$ e $2b−2$ possono essere trovati o meno, a seconda di dove cade il blocco canonico. Tuttavia, per qualsiasi ripetizione di lunghezza almeno $2b-1$, è garantito che almeno un blocco canonico cada interamente all'interno della sottostringa ripetuta — e quel blocco verrà trovato da `checkformatch`. L'estensione in avanti e all'indietro farà poi il resto, ricostruendo l'intero match.

Questa è una proprietà forte: ci assicura che nessuna ripetizione sufficientemente lunga viene mai ignorata.

Un altro vantaggio rispetto ad altri approcci è che il contesto di ricerca è l'**intero testo**, non una finestra di dimensione fissa. Questo è particolarmente utile quando si comprimono file con ripetizioni a lunga distanza — esattamente il caso che motiva l'algoritmo. E tutto questo senza sacrificare l'efficienza: la complessità in tempo è $O(n)$, dovuta all'unica scansione descritta nello pseudocodice e all'aggiornamento in $O(1)$ delle fingerprint. Lo spazio richiesto è $O(n/b)$, determinato dal numero di blocchi canonici memorizzati in tabella hash.

La tabella seguente riassume le complessità delle operazioni principali:

| Operazione | Complessità |
|---|---|
| Inizializzazione fingerprint | $O(b)$ |
| Aggiornamento fingerprint (roll) | $O(1)$ per simbolo |
| Scansione completa dell'input | $O(n)$ |
| Spazio per la hash table | $O(n/b)$ |
| Lunghezza minima match garantito | $\geq 2b - 1$ simboli |

Vale infine la pena notare che nelle implementazioni pratiche $b$ si sceglie tipicamente non troppo piccolo. I motivi sono diversi: un $b$ piccolo aumenta il numero di blocchi canonici da memorizzare, con conseguente aumento sia del tempo di store sia della memoria occupata dalla tabella hash; inoltre, con blocchi molto piccoli, la rappresentazione di un match può costare in memoria quanto — o più di — lasciare i byte come literal, annullando il beneficio della compressione. Infine, spesso l'obiettivo principale è proprio individuare le **macro-ripetizioni** nel testo, quelle a lunga distanza che i compressori classici non riescono a catturare: per questo tipo di ripetizioni un $b$ moderatamente grande è non solo accettabile, ma preferibile.

---

## Utilizzo moderno

Nelle sezioni precedenti abbiamo presentato l'algoritmo, visto come implementarlo e analizzato le sue proprietà. Nonostante sia interessante sotto molti punti di vista, va detto che nell'applicazione pratica alla compressione non viene quasi mai usato direttamente: sono preferiti metodi più maturi e collaudati, che siano dictionary-based come `zstd` o `brotli`, oppure block-sorted come `bzip2`.

Questo non significa però che l'algoritmo di Bentley–McIlroy sia rimasto confinato all'accademia. Viene tuttora impiegato, solo con un ruolo diverso: non come compressore autonomo, ma come **pre-compressore**. L'idea è quella di usarlo in un primo passaggio per individuare e codificare le macro-ripetizioni a lunga distanza — quelle che un compressore standard non riuscirebbe a catturare — e poi passare l'output a un compressore classico, che si occupa delle ridondanze locali e più fini. Questa combinazione è particolarmente efficace quando si lavora con corpus ad alta ridondanza a lungo raggio: log di sistema, archivi di email, grandi repository di codice sorgente, database XML.

Ma l'eredità più concreta dell'algoritmo si trova altrove: nella tecnica dei fingerprint di Rabin–Karp per identificare stringhe comuni tra due file distinti, cioè nel problema della **codifica di delta**. L'idea è semplice: dati due file — una versione vecchia e una nuova — un encoder di delta individua le porzioni in comune e rappresenta la versione nuova come un insieme di riferimenti alla vecchia più le modifiche. Il risultato è una rappresentazione molto compatta della differenza, utile ogni volta che si vuole trasmettere o memorizzare solo ciò che è cambiato.

Uno degli esempi più concreti è [**open-vcdiff**](https://github.com/google/open-vcdiff) [5], l'implementazione di Google del formato [VCDIFF](https://datatracker.ietf.org/doc/html/rfc3284), uno standard IETF per la codifica di delta tra file binari. In questo contesto, il "dizionario sorgente" è la versione precedente del file e il "testo target" è la versione aggiornata. L'encoder — che si ispira direttamente alle idee di Bentley e McIlroy — usa fingerprint di Rabin–Karp per individuare in modo efficiente i blocchi comuni tra le due versioni, senza dover confrontare ogni coppia di posizioni. I match lunghi corrispondono alle parti rimaste invariate e vengono codificati come riferimenti; solo le parti effettivamente cambiate vengono trasmesse per intero. Google impiega questo schema, tra l'altro, per gli aggiornamenti software e la sincronizzazione di file su larga scala: invece di scaricare una nuova versione completa, il client riceve un delta compatto e ricostruisce il file localmente.

---

## La mia implementazione

Come anticipato all'inizio, l'occasione per scrivere questo articolo è nata proprio dal rilascio della mia implementazione in **C++17**, disponibile su [GitHub](https://github.com/Angelido/bentley_mcilroy). Si tratta di una prima versione orientata alla chiarezza e alla correttezza piuttosto che alla velocità massima — nata principalmente per fini accademici e di studio.

Chi volesse provarla può scaricare e compilare il codice con questi comandi:

```bash
git clone https://github.com/Angelido/bentley_mcilroy.git
cd bentley_mcilroy
make
```

La repository include una descrizione della struttura del codice e alcune istruzioni per testarlo su file testuali semplici. Per completezza, riassumo qui i componenti principali dell'implementazione, che rispecchiano fedelmente i passi dell'algoritmo descritti nelle sezioni precedenti:

1. Un fingerprint di Rabin–Karp rolling (polinomio a 64 bit, esposto nei 32 bit bassi) scorre l'input un simbolo alla volta.
2. A ogni boundary canonico (`posizione % b == 0`), il fingerprint viene memorizzato in una hash table con catene FIFO di profondità $k$.
3. A ogni posizione, la hash table viene interrogata per trovare candidati. Ogni candidato viene prima confrontato per fingerprint e poi verificato con `memcmp` per eliminare le collisioni.
4. I match confermati vengono estesi in modo greedy in avanti (senza limite) e all'indietro (fino a $b-1$ simboli).
5. Un match viene emesso solo se il suo costo codificato — `FF 01` più due varint LEB128 — è strettamente inferiore al costo letterale degli stessi byte; altrimenti i byte vengono mantenuti come literal.
6. Il token stream risultante viene serializzato nel formato binario `.bm`.

In ogni caso questa è solo una prima implementazione, e presenta diverse lacune. Le principali limitazioni sono:

- **Single-threaded** — nessun parallelismo tra blocchi.
- **Compressione statica** — l'intero input viene letto in memoria prima di iniziare; una modalità streaming ridurrebbe il picco di memoria.
- **Encoding metadata** — il campo encoding è salvato nell'header `.bm` ma usato solo in fase di compressione per validare la compatibilità con lo stride; potrebbe essere rimosso risparmiando 1 byte per file.

Contributi e miglioramenti sono benvenuti tramite pull request.

---


## Conclusione

In questo post abbiamo visto come funziona l'algoritmo di compressione di Bentley–McIlroy. È un buon esempio di come un'idea semplice — campionare fingerprint invece di confrontare ogni posizione — possa portare a un metodo al tempo stesso efficace e praticamente utile. La sua eleganza sta nel bilanciamento tra memoria ($O(n/b)$), tempo ($O(n)$) e qualità della compressione, governati da un unico parametro $b$, e nell'uso del rolling hash come strumento che rende tutto questo possibile senza rinunciare alla semplicità implementativa.

Non è l'algoritmo più potente nel suo dominio, e non pretende di esserlo. Ma rappresenta, a mio avviso, un ottimo punto di ingresso per chiunque voglia avvicinarsi al mondo della compressione dati: abbastanza semplice da essere compreso nella sua interezza, abbastanza ricco da sollevare domande interessanti.

---

## Riferimenti

1. **A. Nardone** - *Bentley–McIlroy Compressor (C++ Implementation)*, GitHub repository. (2026).
2. **J. Bentley, D. McIlroy** — *Data Compression Using Long Common Strings*, IEEE Data Compression Conference (DCC). (1999).
3. **J. Ziv, A. Lempel** — *A Universal Algorithm for Sequential Data Compression*, IEEE Transactions on Information Theory, 23(3). (1977).
4. **R. Karp, M. Rabin** — *Efficient Randomized Pattern-Matching Algorithms*, IBM Journal of Research and Development, 31(2). (1987).
5. **Google open-vcdiff** — [github.com/google/open-vcdiff](https://github.com/google/open-vcdiff)
