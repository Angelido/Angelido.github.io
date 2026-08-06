L'obiettivo di questo articolo è allo stesso tempo semplice e ambizioso: spiegare, con un percorso ragionevolmente formale ma seguibile, cosa significhi tecnicamente comprimere dati senza perdita, perché sia importante, quale limite teorico imponga l'entropia a qualunque tentativo di compressione, e come i principali paradigmi noti — compressori statistici, a dizionario, block-sorting, e più recentemente neurali — si posizionino rispetto a questo limite. Questo testo è pensato come punto di riferimento: gli articoli futuri (ma anche passati) su singoli algoritmi o famiglie di compressori potranno rimandare qui per le definizioni di base, senza doverle reintrodurre ogni volta.

La domanda che guida l'intero percorso è questa: *se conoscessimo perfettamente la distribuzione di probabilità di una sorgente, quale sarebbe il limite teorico di compressione raggiungibile? E cosa succede quando, come accade quasi sempre nella pratica, quella distribuzione non la conosciamo affatto?* Alla prima domanda risponde l'entropia; la seconda è, in un certo senso, l'intera storia della compressione dati.

---

## Compressione Lossless

La compressione dati, in informatica e telecomunicazioni, riduce il numero di bit necessari per rappresentare un'informazione in forma digitale. Le sue applicazioni sono duplici: da un lato riduce le dimensioni dei file, minimizzando lo spazio di archiviazione richiesto; dall'altro abbassa la banda necessaria per trasmettere dati digitali attraverso i canali di comunicazione. Senza compressione, l'enorme quantità di informazione disponibile su Internet non potrebbe essere distribuita in modo efficiente, dati i limiti intrinseci della banda di trasmissione: in questo senso, la compressione è un pilastro della società digitale, perché garantisce sia la scalabilità dello storage sia l'accessibilità dell'informazione su scala globale.

Fissiamo subito la notazione che useremo in questo articolo e nei futuri. D'ora in poi $\Sigma$ denota un alfabeto finito. I suoi elementi possono variare a seconda del dominio applicativo — numeri interi (integer coding), basi del DNA (compressione di database genomici), caratteri (compressione di testo) — ma, salvo indicazione contraria, tratteremo $\Sigma$ come un insieme di simboli generici su un alfabeto finito.

Siamo pronti a introdurre in modo formale cosa sia un algoritmo di compressione.

:::definition[Schema di compressione lossless]
Sia $\Sigma^\star$ l'insieme di tutte le sequenze finite di simboli prese dall'alfabeto $\Sigma$, e \( \{0,1\}^\star \) l'insieme di tutte le sequenze binarie finite. Uno schema di compressione lossless allora consiste di una coppia di mappe $\gamma = (C, D)$ tali che

\[
    C \, : \, \Sigma^\star \to \{0, 1\}^\star, \quad D \, : \, \{0,1\}^\star \to \Sigma^\star
\]

e che soddisfino la seguente uguaglianza
\[
D(C(S))=S \quad \forall S \in \Sigma^\star
\]
In particolare la mappa $C$ viene chiamata algoritmo di compressione, o codificatore, mentre la mappa $D$ viene chiamata algoritmo di decompressione, o decodificatore.
:::

La sequenza $S$ da comprimere è richiesta finita. La definizione si può estendere a sequenze infinite, per modellare uno stream di dati continuo, ma per semplicità lavoreremo sempre con sequenze finite, salvo dove indicato altrimenti.

Oltre alla definizione principale di compressione, alcune altre nozioni ci aiuteranno a classificare i vari metodi che incontreremo.

:::definition[Parsing]
Sia $C$ un algoritmo di compressione come nella Definizione 1, e sia $S \in \Sigma^\star$ una sequenza di input. Un *parsing* di $S$ è una sua decomposizione in una sequenza di unità (o *frasi*) $s_1, s_2, \dots, s_n$, con $s_i \in \Sigma^+$ sequenze finite non vuote di $\Sigma$, tali che $S = s_1 s_2 \cdots s_n$ (concatenazione). Nel caso più semplice, detto *codifica simbolo per simbolo*, ogni unità coincide con un singolo simbolo ($s_i \in \Sigma$ per ogni $i$); in caso contrario si parla di *codifica a unità variabile*.
:::

Per semplicità, d'ora in poi parsiamo ogni sequenza $S$ simbolo per simbolo: scrivere $S=s_1 s_2 \cdots s_n$ significa quindi che ogni $s_i \in \Sigma$ è un simbolo singolo. Il parsing in frasi più grandi è più raro, e le definizioni seguenti restano comunque valide anche in quel caso. Limitandoci al parsing simbolo per simbolo, inoltre, ogni sequenza $S$ ne ammette uno solo: possiamo quindi parlare *del* parsing di $S$, senza ambiguità.

:::definition[Algoritmo di compressione decomponibile e Codeword]
Sia $C$ un algoritmo di compressione come nella Definizione 1, e sia $S = s_1 s_2 \cdots s_n$ il parsing di $S$. Diciamo che $C$ è *decomponibile* se

\[
C(S) = C(s_1)\,C(s_2) \cdots C(s_n)
\]

e questo vale per ogni $S$. In tal caso, per ogni unità $s_i$ del parsing, la stringa binaria $C(s_i)$ è detta *codeword* di $s_i$.
:::

:::observation
Non tutti gli algoritmi di compressione sono decomponibili rispetto a un parsing dell'input. Per esempio, l' Arithmetic coding e le sue varianti non ammettono, in generale, alcun parsing $S = s_1 \cdots s_n$ per cui $C(S) = C(s_1)\cdots C(s_n)$: l'intera sequenza viene mappata in un'unica stringa binaria tramite un processo di restringimento progressivo di un intervallo, in cui il contributo di ciascun simbolo non è isolabile dal resto. Per questi algoritmi il concetto di codeword, in senso stretto, non si applica.
:::

Abbiamo così tracciato una distinzione importante. Gli algoritmi decomponibili codificano ogni simbolo (o frase) in una codeword fissa; quelli non decomponibili, invece, possono assegnare a uno stesso simbolo codifiche diverse a seconda di dove compare — come negli algoritmi a dizionario — oppure comprimere l'intera sequenza in blocco, come nell'Arithmetic coding. Gli algoritmi decomponibili sono particolarmente diffusi in paradigmi come l'integer coding (che vedremo in un prossimo articolo), e si suddividono ulteriormente in base ad altre proprietà.

:::definition[Codice prefix-free]
Un algoritmo di compressione decomponibile $C$ è detto *prefix-free* se, per ogni $u, v \in \Sigma^+$ con $u \neq v$, nessuna codeword $C(u)$ è prefisso della codeword $C(v)$.
:::

Questa proprietà garantisce che una sequenza di codeword concatenate si possa decodificare in modo univoco: è ciò che permette di spedire un intero stream compresso come un'unica sequenza di bit, senza separatori.

:::definition[Codice a lunghezza variabile]
Un algoritmo di compressione decomponibile $C$ è detto a *lunghezza fissa* se tutte le sue codeword hanno lo stesso numero di bit. Se invece esistono almeno due codeword di lunghezza diversa, $C$ si dice a *lunghezza variabile*.
:::

Questa definizione è fondamentale: come vedremo, è proprio ammettendo lunghezze variabili — assegnando le più corte ai simboli più probabili — che diventa possibile avvicinarsi al limite imposto dall'entropia.

È importante notare che l'output di un algoritmo di compressione raramente coincide con la sola concatenazione delle sue codeword (se è decomponibile) o con i bit grezzi restituiti dalla compressione (negli altri casi). Il file compresso è tipicamente composto da un *preambolo* — le informazioni ausiliarie necessarie al decodificatore, come parametri, tabelle di codifica o metadati strutturali — seguito dal *corpo compresso* vero e proprio, cioè la concatenazione dei bit prodotti dalla compressione. 

### Metriche di valutazione

Finora abbiamo visto come si definisce un algoritmo di compressione. Ma come si valuta se un algoritmo di compressione è buono? Un primo obiettivo, evidente, è ridurre lo spazio occupato dai dati: preambolo e corpo compresso devono quindi, insieme, occupare meno spazio della sequenza originale 
$S$. Notiamo in ogni caso che, per input di grandi dimensioni, il peso del preambolo diventa in genere trascurabile rispetto a quello del corpo.

In generale, se non specificato altrimenti, con $|\cdot|$ intendiamo il numero di bit di una sequenza: per una sequenza binaria \( u \in \{0,1\}^\star\) è semplicemente la sua lunghezza, mentre per una sequenza di simboli $S \in \Sigma^\star$ supponiamo fissata una codifica canonica di riferimento per $\Sigma$ (ad esempio a lunghezza fissa, $\lceil\log_2|\Sigma|\rceil$ bit per simbolo), rispetto alla quale $|S|$ è misurato. Solo nella definizione di *Spazio per Simbolo*, dove serve contare i simboli anziché i bit, $|S|$ andrà inteso in questo senso diverso — lo segnaleremo esplicitamente in quel punto.

Le metriche più comuni per valutare l'efficacia di uno schema di compressione sono le seguenti.

:::definition[Compression Ratio]
Sia $C$ un algoritmo di compressione, e sia $S \in \Sigma^\star$ una sequenza da comprimere, misurata in bit secondo la codifica canonica di riferimento fissata sopra. Denotiamo con $P$ il preambolo prodotto da $C$ e con $S_c$ il corpo compresso, cosicché l'output complessivo sia dato dalla concatenazione $C(S) = P \cdot S_c$. Il *compression ratio* è allora definito come

\[
    \text{Compression Ratio}(S, C) = \frac{|S|}{|P| + |S_c|}
\]

Valori maggiori indicano compressione migliore; un valore pari a 1 indica assenza di compressione, e valori inferiori a 1 indicano un'espansione anziché una riduzione.
:::

:::definition[Percentuale Compressa]
Nelle stesse notazioni della definizione precedente, la *percentuale compressa* è definita come il reciproco del compression ratio, espresso in percentuale:

\[
\text{Compressed Percentage}(S, C) = \frac{1}{\text{Compression Ratio}(S, C)} \cdot 100\% = \frac{|P| + |S_c|}{|S|} \cdot 100\%
\]

A differenza del compression ratio, qui valori più bassi indicano compressione migliore: una percentuale del 100% indica assenza di compressione, mentre valori superiori al 100% segnalano, paradossalmente, un'espansione anziché una riduzione.
:::

:::definition[Guadagno Relativo di Compressione]
Siano $\omega$ ed $\varepsilon$ due schemi di compressione, e siano $(P_\omega, S_{c,\omega})$ e $(P_\varepsilon, S_{c,\varepsilon})$ rispettivamente i preamboli e i corpi compressi ottenuti applicando $C_\omega$ e $C_\varepsilon$ alla stessa sequenza $S$. Il *guadagno relativo di compressione* di $\varepsilon$ rispetto a $\omega$ è definito come

\[
\text{Relative Compression Gain}(S, \varepsilon, \omega) = \frac{(|P_\omega| + |S_{c,\omega}|) - (|P_\varepsilon| + |S_{c,\varepsilon}|)}{|P_\omega| + |S_{c,\omega}|} \cdot 100\%
\]

Un valore positivo indica che $\varepsilon$ comprime meglio di $\omega$, un valore negativo indica il contrario.
:::

:::definition[Spazio per Simbolo]
Nelle notazioni delle definizioni precedenti, lo *spazio per simbolo* prodotto da $C$ è definito come

\[
\text{bit/simbolo}(S, C) = \frac{|P| + |S_c|}{|S|}
\]

dove, coerentemente con la convenzione generale introdotta sopra, il numeratore è già espresso in bit (essendo \(P, S_c \in \{0,1\}^\star\)), mentre il denominatore $|S|$ denota qui il numero di *simboli* di $S$ — senza bisogno, in questo caso, di alcuna codifica di riferimento per $\Sigma$.
:::

A differenza del compression ratio (adimensionale), questa metrica ha le dimensioni di bit per simbolo e permette un confronto diretto con l'entropia $H_0$ (o $H_k$) della sorgente, discussa nella prossima sezione: un algoritmo vicino al limite entropico produrrà un valore di bit/simbolo prossimo a $H_0$.

:::definition[Throughput di Compressione e Decompressione]
Sia $\omega = (C, D)$ uno schema di compressione, e siano $t_C$ e $t_D$ rispettivamente il tempo (in secondi) richiesto per calcolare $C(S)$ e per calcolare $D(C(S))$. Si definiscono il *throughput di compressione* e il *throughput di decompressione* come

\[
\text{Throughput}_C(S, C) = \frac{|S|}{t_C} \qquad \text{Throughput}_D(S, D) = \frac{|S_c|}{t_D}
\]
entrambi misurati in bit al secondo.
:::

Il throughput in compressione misura quanto velocemente $S$ viene ridotto a $S_c$; quello in decompressione, quanto velocemente $S_c$ viene riportato a $S$. Nella pratica i due valori spesso differiscono molto: molti algoritmi — in particolare quelli statistici e block-sorting — sono asimmetrici, con una decompressione considerevolmente più veloce della compressione.

Un buon algoritmo di compressione deve bilanciare, insomma, un alto rapporto di compressione con un alto throughput — un compromesso che ritroveremo, in forme diverse, in ciascuno dei paradigmi discussi nelle prossime sezioni.

### Golden Rule

Prima di ogni altro formalismo, vale la pena fissare un principio intuitivo che guida ogni schema di compressione esistente, indipendentemente dal paradigma: la *golden rule* della compressione, il criterio cardine che ogni algoritmo cerca in qualche modo di seguire.

> *Data una sequenza $S$ da comprimere, i simboli che occorrono più frequentemente in $S$ dovrebbero essere codificati con sequenze di bit più corte, mentre quelli meno frequenti in $S$ dovrebbero ricevere codeword più lunghe.*
>
> — Golden Rule

Un testo in inglese non è una sequenza casuale di caratteri: la lettera E è più frequente della Z, la parola "the" più frequente di "xylophone", una frase ben formata è più prevedibile di una sequenza casuale di parole. La compressione, in un certo senso, è l'arte di sfruttare sistematicamente questa prevedibilità, usando meno bit per le parti più prevedibili.

Questo principio collega direttamente la compressione alle proprietà probabilistiche della sorgente, e conduce naturalmente al concetto di entropia. I paradigmi che vedremo applicano la golden rule in modi molto diversi — assegnando codeword più corte ai simboli frequenti, sostituendo intere sottostringhe ripetute con puntatori compatti, o riorganizzando i dati per rendere le ripetizioni più visibili — ma la domanda che li accomuna resta sempre la stessa: quanto in basso può scendere, in linea di principio, la golden rule?

## Entropia

Fin qui abbiamo introdotto gli strumenti per descrivere e misurare un algoritmo di compressione, ma non ancora un modo per dire se sia *buono*. È possibile, almeno a livello teorico, stabilire se un algoritmo di compressione è ottimo rispetto allo spazio occupato? Non ci interessano qui i limiti in tempo di uno schema di compressione/decompressione, ma se il numero di bit usato da un codificatore per comprimere una sequenza sia teoricamente ottimo, o se si possa fare di meglio. Per rispondere, dobbiamo poter calcolare la probabilità che un certo simbolo compaia in un certo punto della sequenza.

Iniziamo dal caso più semplice: quello in cui ogni simbolo è indipendente dal contesto. Supponiamo dunque che una sorgente emetta simboli $s \in \Sigma$ indipendentemente l'uno dall'altro. Su ogni simbolo di $\Sigma$ è definita una distribuzione di probabilità $p : \Sigma \to [0,1]$, dove $p(s)$ rappresenta la probabilità che la sorgente emetta il simbolo $s$ a ogni passo. Questa funzione deve chiaramente rispettare la condizione

\[
\sum_{s \in \Sigma} p(s) =1
\]

Sorgenti di questo tipo si dicono *senza memoria* (memoryless), poiché la produzione di un simbolo non influenza in alcun modo quella dei successivi. Possiamo ora fornire una definizione formale di entropia, nel caso più semplice possibile, detto **entropia di ordine zero**.

:::definition[Entropia di ordine zero]
Sia dato un alfabeto $\Sigma$ di simboli, dove ogni simbolo è indipendente da tutti gli altri, e sia $p$ una distribuzione di probabilità su $\Sigma$. L'entropia di ordine zero è definita come

\[
\begin{equation}
    H_0 = \sum_{s \in \Sigma} p(s) \cdot \log_2 \frac{1}{p(s)} = -\sum_{s \in \Sigma} p(s)\log_2 p(s)
\end{equation}
\]
:::

:::observation
L'entropia di ordine zero soddisfa sempre $H_0 \geq 0$. Questo accade perché ogni termine della somma è positivo: poiché $p(s) \in [0,1]$ per ogni $s$, abbiamo $\frac{1}{p(s)} \geq 1$, da cui segue $\log_2\frac{1}{p(s)} \geq 0$.
:::

:::observation
Ci chiediamo ora quando sia possibile che $H_0 = 0$. Poiché tutti i termini della somma sono positivi (o nulli), questo può avvenire solo se, per ogni $s \in \Sigma$, vale $p(s) = 0$ oppure $p(s) = 1$. Essendo $p$ una distribuzione di probabilità, e cioè la somma della probabilità dei simboli deve essere uguale a 1, ciò è possibile solo quando esiste un unico simbolo $s'$ tale che $p(s') = 1$, mentre tutti gli altri hanno probabilità nulla:

\[
H_0 = 0 \iff \begin{cases} 
p(s) = 0 & \forall s \neq s' \\
p(s') = 1 & \end{cases}
\]

Questa situazione prende il nome di *distribuzione costante* (o *constant sequence*), poiché la sorgente emette sempre lo stesso simbolo $s'$ con probabilità 1, generando una sequenza completamente prevedibile.
:::

:::observation
L'entropia di ordine zero soddisfa anche la disuguaglianza $H_0 \leq \log_2|\Sigma|$, con uguaglianza quando tutti i simboli sono equiprobabili, cioè quando $p(s) = \frac{1}{|\Sigma|}$ per ogni $s \in \Sigma$. Si parla in questo caso di *distribuzione completamente casuale* (fully random distribution): ogni simbolo ha la stessa probabilità di comparire, e la sorgente è massimamente imprevedibile.
:::

Le due proprietà precedenti si combinano in un unico risultato, $0 \leq H_0 \leq \log_2|\Sigma|$: più la distribuzione è sbilanciata (*skewed*) verso pochi simboli, più bassa è l'entropia; più è bilanciata, più alta è l'entropia. La sorgente più prevedibile ha entropia minima, quella più caotica ha entropia massima.

:::figure[assets/img/binary_entropy_curve.svg]
**Figura 1.** Funzione entropia binaria $H(p) = -p\log_2 p - (1-p)\log_2(1-p)$ per un alfabeto $|\Sigma|=2$, con $p(s) = p$ e $p(\bar{s}) = 1-p$. La curva ha forma a campana: il massimo di 1 bit si raggiunge per $p = 0{,}5$ (distribuzione uniforme, massima incertezza), e la funzione vale $0$ agli estremi $p \in \{0,1\}$ (distribuzione degenere, certezza assoluta).
:::

Il termine $-\log_2 p(s)$ è detto **information content** (o *sorpresa*) del simbolo $s$, e misura quanto è "sorprendente" osservare quel simbolo: se $s$ è molto probabile, $p(s)$ è vicino a 1 e $-\log_2 p(s)$ è vicino a 0 — vedere comparire $s$ non ci dice quasi nulla di nuovo. Se invece $s$ è raro, $p(s)$ è vicino a 0 e $-\log_2 p(s)$ diventa grande — osservarlo porta molta più informazione. Nel caso limite, un simbolo che si verifica con certezza ($p(s)=1$) ha information content nullo ($-\log_2 1 = 0$): non c'è nulla da apprendere, perché l'esito era già scontato.

Questa quantità è anche ciò che determina la lunghezza ideale della codeword: è definita in modo che eventi più probabili corrispondano a codifiche più corte, in linea con la golden rule. Definendo la variabile aleatoria $X(s) = \log_2\frac{1}{p(s)}$, che associa a ogni simbolo il proprio information content, l'entropia si può riscrivere semplicemente come il valore atteso della sorpresa associata ai simboli emessi dalla sorgente, cioè, in altre parole, l'incertezza media della sorgente pesata sulla probabilità con cui ciascun simbolo si presenta. Infatti, per definizione di valore atteso, abbiamo

\[
\begin{equation}
\mathbb{E}[X] = \sum_{s \in \Sigma} p(s) \cdot X(s) = \sum_{s \in \Sigma} p(s) \cdot \log_2\frac{1}{p(s)} = H_0
\end{equation}
\]

cioè esattamente la definizione di $H_0$ data sopra: non è una coincidenza, ma una semplice riscrittura della stessa somma.

Questa uguaglianza ha però un'interpretazione operativa cruciale. Se fosse possibile assegnare a ciascun simbolo $s$ una codeword di lunghezza esattamente pari al suo information content, $\ell(s) = \log_2\frac{1}{p(s)}$ bit, allora la lunghezza media delle codeword — pesata sulla frequenza con cui ciascun simbolo compare nella sorgente — sarebbe esattamente $H_0$. In altre parole, l'entropia $H_0$ rappresenta il numero medio di bit per simbolo necessario a codificare la sorgente, nell'ipotesi (idealizzata) di poter usare lunghezze di codifica frazionarie, non necessariamente intere. Questa osservazione collega direttamente l'entropia con la compressione; collegamento reso rigoroso dal seguente risultato [@shannon1948].

:::theorem[Shannon, 1948]
Per una sorgente discreta e senza memoria, l'entropia $H_0$ rappresenta il limite inferiore fondamentale sul numero medio di bit necessari per codificare ciascun simbolo senza perdita di informazione, usando un algoritmo di compressione prefix-free $C$: 
\[ 
\begin{equation}
    \mathbb{E}[C] \geq H_0 .
\end{equation}
\]
:::

Sebbene il teorema sia spesso enunciato nel contesto dei codici prefix-free, il risultato è in realtà più generale e vale per qualunque codice univocamente decodificabile. I codici prefix-free sono preferiti nella pratica perché permettono una decodifica istantanea e priva di ambiguità, pur riuscendo comunque ad avvicinarsi arbitrariamente al limite entropico. Il teorema non è solo un limite astratto: è un risultato *operazionale*, perché garantisce anche l'esistenza di codici la cui lunghezza media si avvicina arbitrariamente a $H_0$ — il caso limite, con lunghezze frazionarie $\ell(s) = \log_2\frac{1}{p(s)}$, non è realizzabile con un numero intero di bit, ma costruzioni come Huffman coding e Arithmetic coding, che vedremo in seguito, raggiungono o si avvicinano a questo limite [@cover2006].

In sintesi: se conoscessimo esattamente la distribuzione di probabilità di una sorgente senza memoria, l'entropia di ordine zero ci direbbe esattamente qual è il numero minimo di bit per simbolo necessario per rappresentarla senza perdita, in media, e ci garantirebbe che quel limite è raggiungibile. È la prima, fondamentale risposta alla domanda posta nell'introduzione.

:::example
Supponiamo $\Sigma = \{a, b, c\}$ con $p(a) = \tfrac{1}{4}$, $p(b) = \tfrac{1}{2}$, $p(c) = \tfrac{1}{4}$. Allora

\[
H_0 = \tfrac{1}{4}\log_2 4 + \tfrac{1}{2}\log_2 2 + \tfrac{1}{4}\log_2 4 = \tfrac{1}{4}\cdot 2 + \tfrac{1}{2}\cdot 1 + \tfrac{1}{4}\cdot 2 = 1{,}5 \text{ bit/simbolo}
\]

Confrontiamo con un algoritmo di codifica prefix-free $C$. Supponiamo di codificare i simboli nel seguente modo: $C(a) = 0$, $C(b) = 10$, $C(c) = 11$. La sua lunghezza media attesa è dunque

\[
\mathbb{E}[C] = \sum_{s} p(s)\,\ell(C(s)) = \tfrac{1}{4}\cdot 1 + \tfrac{1}{2}\cdot 2 + \tfrac{1}{4}\cdot 2 = 1{,}75 \text{ bit/simbolo}
\]

La codifica $C$ usa 1,75 bit per simbolo contro un limite teorico di 1,5, e non è quindi ottimale: si può fare meglio scambiando le lunghezze di $a$ e $b$, dato che $b$ è il simbolo più probabile e merita la codeword più corta — ancora una volta, la golden rule al lavoro. Con l'assegnazione ottimale $C(b)=0,\ C(a)=10,\ C(c)=11$ si ottiene esattamente $\mathbb{E}[C] = 1{,}5 = H_0$.
:::

### Entropia di ordine k

L'entropia presentata finora si poggia su un'assunzione forte: $H_0$ richiede che ogni simbolo sia indipendente dai precedenti, cosa quasi sempre falsa nei dati reali. In un testo inglese, dopo una Q segue quasi sempre una U; in un file eseguibile, certe sequenze di byte ricorrono sistematicamente; in una serie temporale, il valore attuale dipende fortemente da quelli recenti. Due sorgenti possono avere la stessa distribuzione marginale $p(s)$ — e dunque lo stesso $H_0$ — pur avendo strutture completamente diverse: una del tutto casuale, l'altra fortemente prevedibile dal contesto. $H_0$, da sola, non le distingue.

Per risolvere questo problema si generalizza il concetto assumendo che la probabilità di generare un simbolo dipenda non solo dal simbolo stesso ma anche dai $k$ simboli generati più di recente — modelli noti come **modelli di Markov di ordine $k$**. In questo quadro, la probabilità di generare $s_n \in \Sigma$ è espressa come una probabilità condizionata $p(s_n \mid s_{n-k}, \dots, s_{n-1})$, dove la sequenza $w = (s_{n-k}, \dots, s_{n-1})$ è detta *contesto*.

:::definition[Entropia di ordine $k$]
Sia $\Sigma$ un alfabeto finito e $S = (s_1, \dots, s_n)$ una sequenza di simboli su $\Sigma$. Per un intero fissato $k \geq 1$, l'entropia di ordine $k$ è definita come

\[
\begin{equation}
    H_k = \sum_{w \in \Sigma^k} p(w) \sum_{s \in \Sigma} p(s \mid w) \cdot \log_2 \frac{1}{p(s \mid w)}
\end{equation}
\]

dove $w = (s_{i-k}, \dots, s_{i-1})$ è un contesto di lunghezza $k$, $p(w)$ è la probabilità di osservare quel contesto e infine $p(s \mid w)$ la probabilità condizionata del simbolo $s$ dato il contesto $w$.
:::

Si dimostra che $H_k$ è monotona non crescente in $k$: conoscere più contesto non può che aiutare (o, al più, essere ininfluente) nella predizione. L'**entropia della sorgente** (o *entropy rate*) è allora definita come il limite 
\[
    H = \lim_{k \to \infty} H_k .
\]

:::theorem[Generalizzazione del Teorema di Shannon]
Sia $C$ uno schema di codifica in cui ogni simbolo $s_n$ viene codificato tramite un codice prefix-free $C_w$ che dipende dal contesto $w = (s_{n-k}, \dots, s_{n-1})$ dei $k$ simboli precedenti — cioè, per ogni contesto $w$ possibile, si usa un codice prefix-free diverso, costruito sulla distribuzione condizionata $p(\cdot \mid w)$. Allora la lunghezza media delle codeword prodotte da $C$ soddisfa

\[
\mathbb{E}[C] \geq H_k .
\]
:::

Il risultato segue applicando il Teorema di Shannon separatamente a ciascun contesto. Fissato un contesto $w$, la distribuzione condizionata $p(\cdot \mid w)$ è una distribuzione di probabilità a tutti gli effetti, e il codice $C_w$ non può fare meglio, in media, della sua entropia: la lunghezza media delle codeword condizionata al contesto $w$ è almeno $\sum_{s\in\Sigma} p(s\mid w)\log_2\frac{1}{p(s\mid w)}$. Mediando questa disuguaglianza su tutti i contesti $w$, pesati per la probabilità $p(w)$ di osservarli, si ottiene esattamente $H_k$ a destra e $E[C]$ a sinistra.

Questo risultato conferma, in modo rigoroso, l'intuizione che ha motivato l'introduzione dell'entropia di ordine $k$: condizionare la codifica su un contesto più lungo può solo abbassare (o lasciare invariato) il limite teorico di compressione raggiungibile, mai alzarlo — coerentemente con la monotonia di $H_k$ discussa sopra.

Questo è precisamente il quadro formale usato da Claude Shannon nel suo celebre studio sperimentale sull'inglese scritto [@shannon1951], dove stimò numericamente $H_0, H_1, H_2, H_3$ da tabelle di frequenza di lettere, digrammi e trigrammi, osservandone la discesa monotona (da 4,7 bit/lettera per l'alfabeto uniforme fino a circa 2,1 bit/lettera considerando le frequenze di parole) e ipotizzando, tramite un ingegnoso esperimento di predizione umana, che il valore limite $H$ per l'inglese letterario si aggirasse tra 0,6 e 1,3 bit/lettera — una ridondanza di circa il 75%. Su quest'ultimo esperimento torneremo in un articolo futuro.

Il problema pratico, però, è evidente: per stimare $H_k$ servono statistiche affidabili sui blocchi di $k$ simboli, il cui numero cresce come $|\Sigma|^k$. Già per $k$ moderati il numero di contesti possibili supera qualunque quantità di dati disponibile, e non si osservano mai abbastanza occorrenze per stimare le probabilità in modo affidabile — il problema della sparsità. Contare frequenze esplicite su blocchi lunghi, insomma, non scala: se applicassimo Huffman coding o Arithmetic coding direttamente su blocchi di $k$ simboli anziché sui singoli simboli, otterremmo sì una compressione migliore (perché si catturano le dipendenze tra simboli consecutivi), ma al prezzo di un alfabeto esteso di dimensione $|\Sigma|^k$ e di un preambolo che cresce fino a diventare proibitivo — un problema particolarmente grave per Huffman coding, che deve trasmettere l'intero albero di codifica. È proprio per questo motivo che, nella pratica, si preferiscono tecniche più sofisticate basate su modelli di ordine $k$ stimati in modo adattivo, come PPM, piuttosto che il conteggio esplicito di blocchi.

Il problema, in realtà, non è solo di natura statistica ma anche più profondamente semantico. Modelli a basso ordine come bigrammi e trigrammi sono relativamente facili da stimare e catturano bene le regolarità locali — la Q seguita dalla U, certe combinazioni di lettere frequenti in una lingua — ma non sono in grado di rappresentare dipendenze a lungo raggio: colgono proprietà legate alla frequenza dei simboli, non una vera comprensione del contesto. Aumentare $k$ per catturare dipendenze più profonde, come abbiamo visto, fa esplodere lo spazio dei contesti possibili e, con esso, il preambolo necessario a descriverli. Un compromesso efficace a questo problema sembra essere arrivato solo di recente, con le tecniche di compressione basate su modelli neurali, capaci di stimare probabilità condizionate su contesti lunghi senza doverle tabulare esplicitamente. Ne daremo un primo accenno più avanti in questo stesso articolo, rimandando una trattazione più approfondita a un articolo dedicato.

Questo è esattamente il problema che la storia dei compressori lossless, che presenteremo brevemente in seguito, ha cercato di aggirare — in modi sorprendentemente diversi tra loro, ma sempre riconducibili alla stessa domanda: come sfruttare la struttura a lungo raggio di una sorgente senza dover contare esplicitamente blocchi esponenzialmente lunghi?

### Compressione come stima dell'entropia

Prima di proseguire con la rassegna storica, vale la pena rendere esplicito un punto che attraverserà tutte le sezioni seguenti. Il Teorema di Shannon [@shannon1948] visto sopra vale nell'ipotesi di *conoscere* la distribuzione di probabilità della sorgente: solo in quel caso l'entropia è un limite di compressione raggiungibile. Nella pratica, però, la distribuzione reale non si conosce quasi mai: un compressore deve stimarla dai dati stessi, mentre li elabora.

Questo rovescia la prospettiva in un modo utile. Se un compressore stima bene la distribuzione della sorgente, si avvicinerà al limite entropico; se la stima è scadente, se ne allontanerà. Un buon compressore è quindi, implicitamente, anche un buon stimatore dell'entropia della sorgente: se un algoritmo comprime un testo a 1,2 bit/carattere, quella cifra è anche una stima — più precisamente, un limite superiore — dell'entropia reale del testo. Viceversa, ogni progresso nella stima dell'entropia di una sorgente tende a tradursi in un compressore migliore. Compressione ed entropia sono, in questo senso, la stessa medaglia vista da due lati — un'equivalenza formalizzata rigorosamente [@ornstein1993] e verificata sperimentalmente su testo naturale [@kontoyiannis1998]: è questa equivalenza la lente attraverso cui leggeremo ogni paradigma nella prossima sezione.

## I tre paradigmi

Quello che segue è un percorso sintetico attraverso le tre grandi famiglie di algoritmi di compressione lossless per uso generale, letto attraverso la lente dell'entropia, più un'ultima sezione bonus con un accenno ai compressori neurali. Ogni paradigma avrà, in futuro, un articolo dedicato più approfondito, in cui il funzionamento dei singoli algoritmi sarà trattato in dettaglio formale; qui l'obiettivo resta capire dove si colloca ciascun paradigma rispetto alla nozione di entropia, e quali risultati teorici ne garantiscono — o ne limitano — l'ottimalità.

### Compressori statistici

I compressori statistici sono l'approccio più direttamente radicato nella teoria di Shannon, e operano tipicamente in due fasi distinte: una fase di **modeling**, in cui si raccolgono informazioni statistiche sull'input, seguita da una fase di **coding**, in cui queste informazioni vengono usate per codificare ciascun simbolo in bit. La fase di modeling può essere svolta *offline* — con le statistiche raccolte in un'unica passata sull'input prima che inizi la codifica — oppure *online*, aggiornandole simbolo per simbolo man mano che vengono usate. Nel caso più semplice, quello di ordine zero, il modeling si riduce a contare la frequenza di ciascun simbolo nell'input e a usarla come stima della probabilità del simbolo successivo.

:::figure[assets/img/modeling_coding_schema.svg]
**Figura 2.** Pipeline di un compressore statistico (sopra) e del corrispondente decompressore (sotto): la fase di *modeling* stima la distribuzione di probabilità $p$ dei simboli — ad esempio tramite conteggio di frequenze o un modello di Markov di ordine $k$ — e la fase di *coding* produce il compressed stream minimizzando la lunghezza attesa. Nella decompressione, *modeling* e *decoding* devono riprodurre esattamente le stesse stime usate in compressione, costruendole man mano dai simboli già decodificati.
:::

Lasciamo per un attimo da parte il lato di modeling, e concentriamoci sul lato di coding, dove i due algoritmi più noti sono senza dubbio **Huffman coding** [@huffman1952] e l'**Arithmetic coding** [@rissanen1979].

Huffman coding costruisce un albero binario unendo iterativamente i due nodi meno probabili in un nuovo nodo, fino a ottenere un unico albero; i cammini dalla radice alle foglie definiscono le codeword, che risultano automaticamente prefix-free. Vale il seguente risultato, che quantifica esattamente quanto Huffman coding si discosti dal limite entropico [@huffman1952].

:::theorem[Huffman]
Sia $H_0$ l'entropia di ordine zero di una sorgente su un alfabeto $\Sigma$, e sia $L_H$ la lunghezza media delle codeword prodotte da Huffman coding. Allora $H_0 \leq L_H < H_0 + 1$.
:::

In altre parole, Huffman coding può perdere al più un bit per simbolo rispetto al limite teorico — un overhead che può essere significativo o trascurabile a seconda del valore di $H_0$. Una variante nota come **Canonical Huffman** produce un codice equivalente ma più compatto da memorizzare e trasmettere: anziché l'intero albero, è sufficiente conoscere la lunghezza di ciascuna codeword.

L'Arithmetic coding, introdotta da Elias e poi formalizzata da Rissanen e Langdon [@rissanen1979], adotta un approccio diverso: anziché assegnare una codeword discreta a ciascun simbolo, rappresenta l'intera sequenza come un unico numero reale nell'intervallo $[0,1)$, restringendo via via un sottointervallo in base alle probabilità dei simboli emessi. Il vantaggio rispetto a Huffman coding è quantificato dal seguente risultato [@rissanen1979][@witten1987].

:::theorem[Arithmetic coding]
Il numero di bit prodotti dall'Arithmetic coding per una sequenza $S$ di $n$ simboli è al più $2 + nH_0$, dove $H_0$ è l'entropia (empirica) di $S$.
:::

L'overhead è dunque di soli due bit sull'*intera* sequenza, contro il bit per simbolo di Huffman coding — un vantaggio che si fa sentire soprattutto quando $H_0$ è piccola. Il prezzo da pagare è, in linea di principio, l'uso di aritmetica a precisione infinita; le implementazioni pratiche usano precisione finita, accettando un lieve peggioramento (dell'ordine di $\frac{2}{100}n$ bit aggiuntivi). L'implementazione pratica più nota, dovuta a Witten, Neal e Cleary [@witten1987], è nota come **range coding**: preserva l'equivalenza matematica con l'Arithmetic coding ma opera su sottointervalli a precisione intera, risultando molto più efficiente nella pratica. Più di recente, gli **Asymmetric Numeral Systems (ANS)** [@duda2009] hanno offerto un'alternativa ancora più veloce, che combina l'efficienza di compressione dell'Arithmetic coding con una codifica basata su tabelle che evita del tutto operazioni aritmetiche costose; una variante nota come **range ANS (rANS)** è oggi ampiamente diffusa nei compressori general-purpose moderni, incluso lo stadio di codifica entropica di `zstd`.

Torniamo ora alla fase di modeling, lasciata in sospeso. Il modo più semplice per stimare la probabilità di un simbolo è contarne la frequenza — offline, su tutta la sequenza prima di comprimere, oppure online, aggiornandola man mano — e questo vale tanto per singoli simboli quanto per bigrammi, trigrammi e così via. È un approccio elementare, che funziona bene se accoppiato a coder come Arithmetic coding o Huffman coding, ma non è certo l'unico modo di stimare le probabilità dei simboli. Un caso particolarmente rilevante per gli articoli futuri di questa serie è quello in cui la fase di modeling stima probabilità condizionate a un contesto di lunghezza variabile — è il caso della famiglia **Prediction by Partial Matching (PPM)** [@cleary1984], che retrocede a contesti più corti quando quelli lunghi non dispongono di statistiche sufficienti, affrontando così direttamente il problema di sparsità. Un caso limite interessante, che meriterà un articolo dedicato, è quello in cui la fase di modeling non stima affatto probabilità esplicite, o meglio, le stima, ma le usa poi per produrre un ranking dei simboli candidati dal più al meno probabile — da cui il nome *symbol ranking*. Questa idea nasce come esperimento umano nello stesso studio di Shannon del 1951, e che resterà priva di un'implementazione algoritmica automatica per oltre quarant'anni, fino al lavoro di Fenwick [@fenwick1996][@fenwick1997].

In tutti questi casi, il legame con l'entropia resta quasi per costruzione: più il modello approssima bene la vera $p(s \mid w)$, più la lunghezza di codifica ottenuta con un buon codificatore entropico si avvicina a $H_k$. Il collo di bottiglia pratico non è quasi mai la fase di coding — Huffman coding e l'Arithmetic coding sono entrambi dimostrabilmente vicini all'ottimo — ma la fase di modeling: stimare bene contesti lunghi con dati limitati resta il problema aperto.

### Compressori a dizionario

Un approccio radicalmente diverso evita del tutto di stimare esplicitamente una distribuzione di probabilità, sfruttando invece ripetizioni e pattern ricorrenti nella sequenza di input. L'idea è costruire un dizionario di sottostringhe di $S$ e sostituire le occorrenze successive di quelle sottostringhe con token compatti che fanno riferimento alle voci del dizionario — una strategia particolarmente efficace quando i dati presentano sottostringhe ripetute (una proprietà comune sia nei testi che nei file binari), e che non richiede alcuna conoscenza a priori della distribuzione della sorgente.

Quasi tutti i compressori a dizionario moderni si basano su un'idea introdotta nel 1977 da Ziv e Lempel [@ziv1977], nota come **LZ77**, in cui il dizionario è costruito dinamicamente man mano che l'input viene processato, usando una finestra scorrevole di ricerca $W$ (contenente la porzione già codificata di $S$) e un buffer di lookahead $B$ (il prossimo segmento da codificare). L'encoder cerca, scorrendo all'indietro in $W$, il prefisso più lungo $\alpha$ del buffer di lookahead che compare anche in $W \cdot B$: se lo trova, emette una tripla $\langle d, |\alpha|, c\rangle$, dove $d$ è la distanza dall'inizio di $B$, $|\alpha|$ la lunghezza del match e $c$ il simbolo che segue $\alpha$; altrimenti emette $\langle 0, 0, B[1]\rangle$. Una variante elegante, **LZSS** [@storer1982], emette solo coppie anziché triple, rimuovendo la necessità di codificare esplicitamente il simbolo successivo quando esiste un match. Un anno dopo, gli stessi autori introdussero **LZ78** [@ziv1978], che costruisce il dizionario in modo incrementale assegnando identificatori alle nuove frasi anziché fare riferimento a posizioni nella finestra: in pratica LZ77 è diventato di gran lunga il più diffuso, mentre LZ78 è progressivamente caduto in disuso, pur restando più veloce (a scapito di un rapporto di compressione tipicamente peggiore).

:::figure[assets/img/lz77_example.svg]
**Figura 3.** Esempio di codifica LZ77 sulla stringa $S = \texttt{aacaacabcabaaac}$ con finestra di ricerca $|W| = 6$ e buffer di lookahead $|B| = 4$. Ogni riga mostra lo stato della finestra scorrevole (in verde), il match trovato nel buffer di lookahead (in arancione) e il simbolo letterale successivo al match (in rosso), insieme al token emesso $\langle d, \ell, c \rangle$ — distanza dall'inizio del buffer, lunghezza del match e carattere letterale. Al passo 1 il dizionario è ancora vuoto e si emette il solo letterale $\texttt{a}$; ai passi successivi l'encoder trova match di lunghezza crescente, comprimendo l'intera stringa in 5 token.
:::

LZ77 non è rimasto, comunque, l'algoritmo usato tal quale nelle applicazioni odierne: sono nate moltissime varianti a partire dall'idea originale di Ziv e Lempel. Una delle implementazioni più influenti è probabilmente **gzip** [@deutsch1996], che sostituisce la lenta scansione lineare della finestra con strutture dati dedicate come le hash table, e combina LZ77 con Huffman coding per codificare simboli letterali e lunghezze di match in un alfabeto unificato. Altre estensioni si sono spinte in direzioni diverse: **LZMA** [@pavlov2007] (usato in `7-Zip`) combina finestre di ricerca molto più ampie con schemi di codifica entropica più sofisticati; **Brotli** [@brotli2016], sviluppato da Google, supporta contesti statici e dinamici; **LZ4** [@lz4] è ottimizzato per la velocità; **Zstandard** (`zstd`) [@zstd2018], introdotto da Facebook, bilancia velocità e rapporto di compressione in modo altamente configurabile ed è diventato uno standard de facto nelle applicazioni moderne — non a caso, il suo stadio di codifica entropica si basa proprio su una variante tabellare di ANS (**tANS**), a conferma di quanto la famiglia ANS sia ormai pervasiva nei compressori pratici.

Sul piano teorico, LZ77 e LZ78 godono di garanzie di ottimalità rispetto all'entropia, anche se di natura diversa. Iniziamo a vedere quello di LZ78 [@ziv1978].

:::theorem[Ottimalità asintotica di LZ78, Ziv & Lempel 1978]
Sia $S$ una sequenza generata da una sorgente stazionaria con entropy rate $H$. Al crescere della lunghezza di $S$, il rapporto di compressione (in bit per simbolo) prodotto da LZ78 converge a $H$: LZ78 è asintoticamente ottimo tra i compressori a stati finiti.
:::

In termini più precisi, si dice che LZ78 è *coarsely optimal*: il suo rapporto di compressione si avvicina all'entropia di ordine $k$ con uno scarto additivo fisso, ma non è *$\rho$-ottimo*, perché l'errore non è proporzionale a $H_k$ e può quindi diventare significativo quando l'entropia è piccola. LZ77, pur più efficace in pratica, non raggiunge la piena ottimalità per contesti di ordine elevato — esiste però un bound non asintotico, indipendente da ogni assunzione probabilistica sulla sorgente [@kosaraju1999].

:::theorem[Kosaraju & Manzini, 1999]
Sia $s$ una stringa di lunghezza $n$ su un alfabeto $\Sigma$, e sia $H_0(s)$ la sua entropia empirica di ordine zero. Il numero di bit prodotti da LZ77 per comprimere $s$ è limitato da $8nH_0(s)$, a meno di termini di ordine inferiore.
:::

È un risultato "worst-case", nello spirito dell'analisi *individual-sequence* introdotta dagli stessi Ziv e Lempel: vale per ogni stringa, senza alcuna assunzione sulla sorgente che l'ha generata.

### Compressori block-sorting

Un terzo paradigma, introdotto molto più tardi grazie alla **Burrows-Wheeler Transform (BWT)** [@burrows1994], funziona in modo del tutto diverso dai due precedenti. Va sottolineato che la BWT non è di per sé un algoritmo di compressione, perché non riduce la dimensione dell'input: è piuttosto una permutazione reversibile dei simboli di $S$, ottenuta ordinando lessicograficamente tutte le rotazioni cicliche della sequenza, che riorganizza l'input in modo da raggruppare vicine le occorrenze di simboli che condividono lo stesso contesto. Essendo una permutazione, la trasformazione è per costruzione invertibile — proprietà indispensabile perché un algoritmo basato su BWT possa garantire decompressione lossless. La costruzione della BWT può essere effettuata in tempo $O(n)$ sfruttando la struttura del suffix array [@ferragina2023], la stessa complessità con cui la sequenza originale può essere ricostruita a partire dalla sua trasformata.

:::figure[assets/img/bwt_example.svg]
**Figura 4.** Calcolo della BWT sulla stringa $S = \texttt{BANANA}\\\$ $ (il simbolo $\\\$ $ è il terminatore lessicograficamente minore di ogni altro simbolo). A sinistra: le 7 rotazioni cicliche di $S$ nell'ordine in cui vengono costruite. A destra: le stesse rotazioni ordinate lessicograficamente — la prima colonna (FC) è ordinata per costruzione; l'ultima colonna (BWT), evidenziata in arancione, è l'output della trasformazione: $\texttt{BNN\\\$AAA}$. La riga $i = 3$ della matrice ordinata coincide con la stringa originale; questo indice è il *primary index* trasmesso insieme alla BWT e necessario per la decompressione.
:::

Da sola, la BWT non produce compressione: va combinata con trasformazioni successive, tipicamente il **Move-To-Front (MTF)** [@bentley1986] e il **Run-Length Encoding (RLE)**. Il MTF sostituisce ogni simbolo con la sua posizione in una lista dinamicamente aggiornata, portando poi quel simbolo in cima alla lista: il risultato è una sequenza di interi tipicamente piccoli, che si presta bene a essere ulteriormente compressa da un codice per interi (o dai compressori statistici visti sopra). Il RLE, applicato dopo il MTF, sostituisce le lunghe corse di simboli identici (tipicamente zeri, dopo il MTF) con coppie lunghezza-simbolo. Questa combinazione — BWT, seguita da MTF, seguita da RLE e infine da un codificatore entropico come Huffman coding — è alla base della famiglia di algoritmi **bzip**, tra le più note e diffuse in pratica: implementazioni come `bzip2` partizionano l'input in blocchi indipendenti (tipicamente tra 100 KB e 900 KB) e applicano l'intera pipeline separatamente a ciascun blocco, da cui il nome *block-sorting*.

Il legame con l'entropia, in questo paradigma, poggia su uno dei risultati teorici più solidi e citati di tutta l'analisi della compressione [@manzini2001].

:::theorem[Manzini, 2001]
Sia $s$ una sequenza di $n$ simboli su un alfabeto $\Sigma$, e sia $H_k(s)$ la sua entropia empirica di ordine $k$. Esiste una famiglia di compressori basati su BWT (combinata con MTF e un codificatore a ordine zero) tale che, per ogni $k \geq 0$ **simultaneamente**, il numero di bit prodotti in output è limitato da

\[
n \, H_k(s) \;+\; g_k(|\Sigma|)
\]

dove $g_k(|\Sigma|)$ è un termine che dipende solo da $k$ e dalla dimensione dell'alfabeto, non da $n$.
:::

È un risultato notevole: a differenza dei compressori statistici classici, che devono fissare un ordine $k$ a priori (pagando in sparsità se $k$ è troppo alto), un compressore basato su BWT si comporta bene rispetto a tutti gli ordini contemporaneamente, senza doverli scegliere esplicitamente. Questo spiega, tra l'altro, un fatto empirico altrimenti sorprendente: se un compressore statistico che da solo raggiunge un rapporto di compressione vicino all'entropia di ordine zero viene preceduto da uno stadio BWT, il processo complessivo agisce come un vero e proprio *compression booster*, portando il rapporto di compressione dall'ordine zero fino a quello di ordine $k$ — motivo per cui `bzip2` può superare sia i compressori statistici puri sia, spesso, compressori a dizionario come `gzip`.

Vale la pena notare, come punto di contatto diretto con il paradigma predittivo accennato parlando della fase di modeling dei compressori statistici, che Fenwick [@fenwick1996] mostrò come il block-sorting sia, concettualmente, un'altra forma di symbol ranking: la trasformazione Move-To-Front applicata dopo l'ordinamento BWT assegna implicitamente ranghi ai simboli in base alla loro recenza all'interno di ciascun contesto, esattamente come fa — in modo esplicito e sequenziale, anziché tramite permutazione — un compressore predittivo per ranking.

### Un cenno ai metodi neurali

Gli algoritmi presentati come rappresentanti dei tre paradigmi — e gli altri non citati direttamente qui — restano ottimi compressori lossless, con risultati migliori o peggiori a seconda del contesto, capaci di bilanciare una buona capacità predittiva con un'ottima velocità di esecuzione. Negli ultimi anni, però, la rapida crescita degli archivi digitali — alimentata in buona parte dalla necessità di raccogliere sempre più dati per addestrare modelli di intelligenza artificiale — ha reso necessario trovare modi di comprimere ancora più efficienti. I risultati offerti da questi compressori standard non sono sempre più sufficienti: per quanto rispettino teoricamente i limiti imposti dall'entropia, la mancanza di buoni stimatori della distribuzione di probabilità (nel caso dei compressori statistici), o i limiti strutturali su sequenze con poche ripetizioni (nel caso dei compressori a dizionario o block-sorting), allontanano questi risultati dal vero ottimo raggiungibile.

Per affrontare questo problema, nell'ultimo decennio la fase di modeling dei compressori statistici è stata sempre più spesso affidata a reti neurali, capaci di stimare $p(s \mid w)$ per contesti $w$ arbitrariamente lunghi, mescolando le predizioni di modelli diversi (come nei compressori a *context mixing* della famiglia PAQ [@mahoney2005]) o tramite architetture sequenziali dedicate. Il principio resta identico a quello enunciato in precedenza: la cross-entropia di un modello $Q$ rispetto alla vera distribuzione $p$ della sorgente, $H(p,Q) = -\sum_s p(s)\log_2 Q(s)$, soddisfa sempre $H(p,Q) \geq H(p)$ — la generalizzazione diretta del teorema di Shannon al caso in cui il modello usato per codificare non coincide esattamente con la vera distribuzione della sorgente. Ogni stima ottenuta tramite un modello, neurale o meno, è dunque sempre un limite superiore all'entropia reale, mai una misura esatta, tanto più stretto quanto migliore è il modello. Il punto centrale è che i modelli neurali riescono ad avvicinarsi alla vera distribuzione della sorgente molto più dei metodi standard.

Questa equivalenza tra predizione e compressione è stata resa esplicita ed empirica in tempi recenti. Diversi lavori recenti nel campo della compressione lossless — sia su testo [@finezip2024][@alphazip2024], sia su codice sorgente [@nardone2026], sia su altri tipi di dati come video o immagini [@deletang2023] — mostrano che grandi modelli linguistici, usati come predittori accoppiati a un codificatore aritmetico oppure all'interno di una pipeline di symbol ranking, ottengono rapporti di compressione nettamente migliori di quelli offerti da compressori general-purpose o specializzati sui dati specifici: è la chiusura naturale del cerchio aperto dall'esperimento di predizione umana di Shannon nel 1951. Il problema di queste famiglie di compressori resta però il loro scarso throughput, che ancora oggi ne limita fortemente l'applicabilità in contesti reali. 

### Cosa resta fuori

Questo articolo si è concentrato sul definire la compressione lossless e introdurre l'entropia come limite generale per la compressione di sequenze di simboli generiche, tipicamente testo. Esistono però famiglie di dati con struttura propria per cui si usano tecniche più specifiche, spesso non riconducibili direttamente a un singolo valore di entropia nel senso qui discusso: è il caso della codifica di sequenze di interi (codici di Elias, Golomb-Rice, Elias-Fano), pensata per distribuzioni particolari tipiche di applicazioni come le posting list nei motori di ricerca, o delle tecniche di compressione lossy (in cui una piccola perdita di informazioni è accettata) per immagini, audio e video, dove il limite teorico rilevante non è più l'entropia della sorgente ma una nozione diversa (la funzione rate-distortion). Questi argomenti meritano trattazioni dedicate, così come del resto meriterebbero gli stessi algoritmi qui solo accennati. Ma questo articolo introduttivo è già andato per le lunghe: è meglio chiuderlo qui, e rimandare le trattazioni specifiche agli articoli futuri.

## Conclusione

Siamo partiti da una domanda semplice: cosa significa comprimere dati senza perdita, e perché lo facciamo? Abbiamo visto come la compressione lossless non sia solo un problema pratico di spazio e banda, ma anche un problema con un limite teorico preciso — e che quel limite ha un nome: entropia. È lei il filo che lega, silenziosamente, famiglie di algoritmi che a prima vista sembrano avere ben poco in comune: un codice a lunghezza variabile costruito su una tabella di frequenze, un dizionario di sottostringhe ripetute, una permutazione lessicografica di un intero testo, o i pesi di una rete neurale con miliardi di parametri. In ogni caso, il problema è sempre lo stesso — stimare, esplicitamente o implicitamente, quanto è prevedibile una sorgente — e ogni paradigma discusso in questo articolo è, in fondo, una risposta diversa alla stessa domanda posta nell'introduzione: quanto in basso può scendere la golden rule?

I prossimi articoli di questa serie approfondiranno singolarmente ciascun paradigma qui solo accennato, trattando in dettaglio formale il funzionamento dei rispettivi algoritmi; questo testo resta il punto di riferimento a cui torneranno per collocare l'algoritmo discusso rispetto alla nozione di entropia.

## Riferimenti

[brotli2016] Alakuijala, J. & Szabadka, Z. (2016). *Brotli Compressed Data Format*. RFC 7932. IETF.

[bentley1986] Bentley, J. L. & Sleator, D. D. & Tarjan, R. E. & Wei, V. K. (1986). *A Locally Adaptive Data Compression Scheme*. Communications of the ACM, 29(4):320–330.

[finezip2024] Bhatt, R. & Acharya, A. & Arora, A. & Varshney, L. R. (2024). *FineZip: Pushing Large Language Models for Lossless Text Compression to the Limit*. arXiv:2409.17357.

[burrows1994] Burrows, M. & Wheeler, D. J. (1994). *A Block-Sorting Lossless Data Compression Algorithm*. SRC Research Report 124, Digital Equipment Corporation.

[cleary1984] Cleary, J. G. & Witten, I. H. (1984). *Data Compression Using Adaptive Coding and Partial String Matching*. IEEE Transactions on Communications, 32(4):396–402.

[lz4] Collet, Y. (2011). *LZ4: Extremely Fast Compression Algorithm*. GitHub. Available at: github.com/lz4/lz4.

[zstd2018] Collet, Y. & Kucherawy, M. (2018). *Zstandard Compression and the Application/Zstd Media Type*. RFC 8478. IETF.

[cover2006] Cover, T. M. & Thomas, J. A. (2006). *Elements of Information Theory*, 2nd ed. Wiley-Interscience.

[deletang2023] Delétang, G. & Ruoss, A. & Duquenne, P.-A. & Catt, E. & Genewein, T. & Mattern, C. & Grau-Moya, J. & Wenliang, L. K. & Aitchison, M. & Orseau, L. & Hutter, M. & Veness, J. (2023). *Language Modeling Is Compression*. ICLR 2024. arXiv:2309.10668.

[deutsch1996] Deutsch, P. (1996). *DEFLATE Compressed Data Format Specification Version 1.3*. RFC 1951.

[duda2009] Duda, J. (2009). *Asymmetric Numeral Systems*. arXiv:0902.0271.

[fenwick1996] Fenwick, P. (1996). *Symbol Ranking Text Compression*. Technical Report 132, University of Auckland, Department of Computer Science.

[fenwick1997] Fenwick, P. (1997). *Symbol Ranking Text Compression with Shannon Recodings*. Journal of Universal Computer Science, 3(2):70–85.

[ferragina2023] Ferragina, P. (2023). *Pearls of Algorithm Engineering*. Cambridge University Press.

[huffman1952] Huffman, D. A. (1952). *A Method for the Construction of Minimum-Redundancy Codes*. Proceedings of the IRE, 40(9):1098–1101.

[kontoyiannis1998] Kontoyiannis, I. & Algoet, P. H. & Suhov, Y. M. & Wyner, A. J. (1998). *Nonparametric Entropy Estimation for Stationary Processes and Random Fields, with Applications to English Text*. IEEE Transactions on Information Theory, 44(3):1319–1327.

[kosaraju1999] Kosaraju, S. R. & Manzini, G. (1999). *Compression of Low Entropy Strings with Lempel-Ziv Algorithms*. SIAM Journal on Computing, 29(3):893–911.

[mahoney2005] Mahoney, M. V. (2005). *Adaptive Weighing of Context Models for Lossless Data Compression*. Technical Report CS-2005-16, Florida Institute of Technology.

[manzini2001] Manzini, G. (2001). *An Analysis of the Burrows-Wheeler Transform*. Journal of the ACM, 48(3):407–430.

[alphazip2024] Narasimhan, S. S. & Chandrachoodan, N. (2024). *AlphaZip: Neural Network-Enhanced Lossless Text Compression*. arXiv:2409.15046.

[nardone2026] Nardone, A. & Ferragina, P. (2026). *LLM-based Source Code Compression via Thresholded Symbol Ranking*. arXiv:2607.241.

[ornstein1993] Ornstein, D. S. & Weiss, B. (1993). *Entropy and Data Compression Schemes*. IEEE Transactions on Information Theory, 39(1):78–83.

[pavlov2007] Pavlov, I. (2007). *LZMA Specification*. 7-Zip. Available at: 7-zip.org/sdk.html.

[rissanen1979] Rissanen, J. & Langdon, G. G. (1979). *Arithmetic Coding*. IBM Journal of Research and Development, 23(2):149–162.

[shannon1948] Shannon, C. E. (1948). *A Mathematical Theory of Communication*. Bell System Technical Journal, 27(3):379–423; 27(4):623–656.

[shannon1951] Shannon, C. E. (1951). *Prediction and Entropy of Printed English*. Bell System Technical Journal, 30(1):50–64.

[storer1982] Storer, J. A. & Szymanski, T. G. (1982). *Data Compression via Textual Substitution*. Journal of the ACM, 29(4):928–951.

[witten1987] Witten, I. H. & Neal, R. M. & Cleary, J. G. (1987). *Arithmetic Coding for Data Compression*. Communications of the ACM, 30(6):520–540.

[ziv1977] Ziv, J. & Lempel, A. (1977). *A Universal Algorithm for Sequential Data Compression*. IEEE Transactions on Information Theory, 23(3):337–343.

[ziv1978] Ziv, J. & Lempel, A. (1978). *Compression of Individual Sequences via Variable-Rate Coding*. IEEE Transactions on Information Theory, 24(5):530–536.