The goal of this article is at once simple and ambitious: to explain, through a reasonably formal yet accessible path, what it technically means to compress data without loss, why this matters, what theoretical limit entropy imposes on any compression attempt, and how the main known paradigms — statistical compressors, dictionary-based compressors, block-sorting compressors, and, more recently, neural compressors — position themselves with respect to this limit. This text is meant as a reference point: future articles (as well as past ones) on individual algorithms or families of compressors will be able to point back here for the basic definitions, without having to reintroduce them each time.

The question guiding the whole path is this: *if we knew perfectly the probability distribution of a source, what would be the theoretical compression limit achievable? And what happens when, as is almost always the case in practice, we do not know that distribution at all?* Entropy answers the first question; the second is, in a sense, the entire history of data compression.

---

## Lossless Compression

Data compression, in computer science and telecommunications, reduces the number of bits needed to represent information in digital form. Its applications are twofold: on the one hand, it reduces file sizes, minimizing the storage space required; on the other, it lowers the bandwidth needed to transmit digital data across communication channels. Without compression, the enormous amount of information available on the Internet could not be distributed efficiently, given the intrinsic limits of transmission bandwidth: in this sense, compression is a cornerstone of the digital society, since it guarantees both the scalability of storage and the accessibility of information on a global scale.

Let us fix right away the notation we will use in this article and in future ones. From now on, $\Sigma$ denotes a finite alphabet. Its elements may vary depending on the application domain — integers (integer coding), DNA bases (genomic database compression), characters (text compression) — but, unless stated otherwise, we will treat $\Sigma$ simply as a set of generic symbols over a finite alphabet.

We are now ready to formally introduce what a compression algorithm is.

:::definition[Lossless Compression Scheme]
Let $\Sigma^\star$ be the set of all finite sequences of symbols drawn from the alphabet $\Sigma$, and \( \{0,1\}^\star \) the set of all finite binary sequences. A lossless compression scheme then consists of a pair of maps $\gamma = (C, D)$ such that

\[
    C \, : \, \Sigma^\star \to \{0, 1\}^\star, \quad D \, : \, \{0,1\}^\star \to \Sigma^\star
\]

and satisfying the equality
\[
D(C(S))=S \quad \forall S \in \Sigma^\star
\]
In particular, the map $C$ is called the compression algorithm, or encoder, while the map $D$ is called the decompression algorithm, or decoder.
:::

The sequence $S$ to be compressed is required to be finite. The definition can be extended to infinite sequences, to model a continuous data stream, but for simplicity we will always work with finite sequences, unless stated otherwise.

Beyond the main definition of compression, a few further notions will help us classify the various methods we will encounter.

:::definition[Parsing]
Let $C$ be a compression algorithm as in Definition 1, and let $S \in \Sigma^\star$ be an input sequence. A *parsing* of $S$ is a decomposition of $S$ into a sequence of units (or *phrases*) $s_1, s_2, \dots, s_n$, with $s_i \in \Sigma^+$ finite non-empty sequences over $\Sigma$, such that $S = s_1 s_2 \cdots s_n$ (concatenation). In the simplest case, called *symbol-by-symbol coding*, each unit coincides with a single symbol ($s_i \in \Sigma$ for every $i$); otherwise, we speak of *variable-unit coding*.
:::

For simplicity, from now on we parse every sequence $S$ symbol by symbol: writing $S=s_1 s_2 \cdots s_n$ therefore means that every $s_i \in \Sigma$ is a single symbol. Parsing into larger phrases is rarer, and the definitions that follow remain valid in that case as well. Furthermore, restricting ourselves to symbol-by-symbol parsing, every sequence $S$ admits exactly one such parsing: we can therefore speak of *the* parsing of $S$, without ambiguity.

:::definition[Decomposable Compression Algorithm and Codeword]
Let $C$ be a compression algorithm as in Definition 1, and let $S = s_1 s_2 \cdots s_n$ be the parsing of $S$. We say that $C$ is *decomposable* if

\[
C(S) = C(s_1)\,C(s_2) \cdots C(s_n)
\]

and this holds for every $S$. In that case, for every unit $s_i$ of the parsing, the binary string $C(s_i)$ is called the *codeword* of $s_i$.
:::

:::observation
Not every compression algorithm is decomposable with respect to a parsing of the input. Arithmetic coding and its variants, for instance, do not admit, in general, any parsing $S = s_1 \cdots s_n$ for which $C(S) = C(s_1)\cdots C(s_n)$: the entire sequence is mapped into a single binary string through a process of progressively narrowing an interval, in which each symbol's contribution cannot be isolated from the rest. For these algorithms, the notion of codeword, strictly speaking, does not apply.
:::

We have thus drawn an important distinction. Decomposable algorithms encode each symbol (or phrase) into a fixed codeword; non-decomposable ones, by contrast, may assign different encodings to the same symbol depending on where it occurs — as in dictionary-based algorithms — or compress the entire sequence as a single block, as in Arithmetic coding. Decomposable algorithms are especially common in paradigms such as integer coding (which we will cover in a future article), and they can be further subdivided based on additional properties.

:::definition[Prefix-Free Code]
A decomposable compression algorithm $C$ is said to be *prefix-free* if, for every $u, v \in \Sigma^+$ with $u \neq v$, no codeword $C(u)$ is a prefix of the codeword $C(v)$.
:::

This property guarantees that a sequence of concatenated codewords can be decoded unambiguously: it is what makes it possible to send an entire compressed stream as a single sequence of bits, without separators.

:::definition[Variable-Length Code]
A decomposable compression algorithm $C$ is said to be *fixed-length* if all its codewords have the same number of bits. If, instead, there exist at least two codewords of different lengths, $C$ is said to be *variable-length*.
:::

This definition is fundamental: as we will see, it is precisely by allowing variable lengths — assigning the shortest ones to the most probable symbols — that it becomes possible to approach the limit imposed by entropy.

It is important to note that the output of a compression algorithm rarely coincides with the mere concatenation of its codewords (if it is decomposable) or with the raw bits returned by compression (in other cases). The compressed file typically consists of a *preamble* — the auxiliary information the decoder needs, such as parameters, coding tables, or structural metadata — followed by the actual *compressed body*, i.e., the concatenation of the bits produced by compression.

### Evaluation Metrics

So far we have seen how a compression algorithm is defined. But how do we evaluate whether a compression algorithm is good? A first, obvious goal is to reduce the space occupied by the data: preamble and compressed body must therefore, together, occupy less space than the original sequence $S$. Note, in any case, that for large inputs the weight of the preamble typically becomes negligible compared to that of the body.

In general, unless stated otherwise, by $|\cdot|$ we mean the number of bits of a sequence: for a binary sequence \(u \in \{0,1\}^\star \) this is simply its length, while for a sequence of symbols $S \in \Sigma^\star$ we assume a canonical reference encoding for $\Sigma$ is fixed (for instance, a fixed-length encoding of $\lceil\log_2|\Sigma|\rceil$ bits per symbol), with respect to which $|S|$ is measured. Only in the definition of *Space per Symbol*, where we need to count symbols rather than bits, will $|S|$ be understood in this different sense — we will flag it explicitly at that point.

The most common metrics for evaluating the effectiveness of a compression scheme are the following.

:::definition[Compression Ratio]
Let $C$ be a compression algorithm, and let $S \in \Sigma^\star$ be a sequence to compress, measured in bits according to the canonical reference encoding fixed above. Denote by $P$ the preamble produced by $C$ and by $S_c$ the compressed body, so that the overall output is given by the concatenation $C(S) = P \cdot S_c$. The *compression ratio* is then defined as

\[
    \text{Compression Ratio}(S, C) = \frac{|S|}{|P| + |S_c|}
\]

Higher values indicate better compression; a value of 1 indicates no compression, and values below 1 indicate expansion rather than reduction.
:::

:::definition[Compressed Percentage]
Using the same notation as in the previous definition, the *compressed percentage* is defined as the reciprocal of the compression ratio, expressed as a percentage:

\[
\text{Compressed Percentage}(S, C) = \frac{1}{\text{Compression Ratio}(S, C)} \cdot 100\% = \frac{|P| + |S_c|}{|S|} \cdot 100\%
\]

Unlike the compression ratio, here lower values indicate better compression: a percentage of 100% indicates no compression, while values above 100% paradoxically signal expansion rather than reduction.
:::

:::definition[Relative Compression Gain]
Let $\omega$ and $\varepsilon$ be two compression schemes, and let $(P_\omega, S_{c,\omega})$ and $(P_\varepsilon, S_{c,\varepsilon})$ be, respectively, the preambles and compressed bodies obtained by applying $C_\omega$ and $C_\varepsilon$ to the same sequence $S$. The *relative compression gain* of $\varepsilon$ with respect to $\omega$ is defined as

\[
\text{Relative Compression Gain}(S, \varepsilon, \omega) = \frac{(|P_\omega| + |S_{c,\omega}|) - (|P_\varepsilon| + |S_{c,\varepsilon}|)}{|P_\omega| + |S_{c,\omega}|} \cdot 100\%
\]

A positive value indicates that $\varepsilon$ compresses better than $\omega$; a negative value indicates the opposite.
:::

:::definition[Space per Symbol]
Using the notation of the previous definitions, the *space per symbol* produced by $C$ is defined as

\[
\text{bits/symbol}(S, C) = \frac{|P| + |S_c|}{|S|}
\]

where, consistently with the general convention introduced above, the numerator is already expressed in bits (since \(P, S_c \in \{0,1\}^\star\)), while the denominator $|S|$ here denotes the number of *symbols* of $S$ — with no need, in this case, for any reference encoding of $\Sigma$.
:::

Unlike the compression ratio (which is dimensionless), this metric has the dimension of bits per symbol and allows a direct comparison with the entropy $H_0$ (or $H_k$) of the source, discussed in the next section: an algorithm close to the entropy limit will produce a bits/symbol value close to $H_0$.

:::definition[Compression and Decompression Throughput]
Let $\omega = (C, D)$ be a compression scheme, and let $t_C$ and $t_D$ be, respectively, the time (in seconds) required to compute $C(S)$ and to compute $D(C(S))$. We define the *compression throughput* and the *decompression throughput* as

\[
\text{Throughput}_C(S, C) = \frac{|S|}{t_C} \qquad \text{Throughput}_D(S, D) = \frac{|S_c|}{t_D}
\]
both measured in bits per second.
:::

Compression throughput measures how quickly $S$ is reduced to $S_c$; decompression throughput measures how quickly $S_c$ is turned back into $S$. In practice the two values often differ substantially: many algorithms — statistical and block-sorting ones in particular — are asymmetric, with decompression considerably faster than compression.

A good compression algorithm must, in short, balance a high compression ratio with high throughput — a trade-off we will encounter, in different forms, in each of the paradigms discussed in the sections that follow.

### Golden Rule

Before any further formalism, it is worth fixing an intuitive principle that guides every existing compression scheme, regardless of the paradigm: the *golden rule* of compression, the core criterion that every algorithm tries, in some way, to follow.

> *Given a sequence $S$ to compress, symbols that occur more frequently in $S$ should be encoded with shorter bit sequences, while less frequent symbols in $S$ should receive longer codewords.*
>
> — Golden Rule

A text in English is not a random sequence of characters: the letter E is more frequent than Z, the word "the" more frequent than "xylophone", a well-formed sentence more predictable than a random sequence of words. Compression, in a sense, is the art of systematically exploiting this predictability, using fewer bits for the more predictable parts.

This principle directly links compression to the probabilistic properties of the source, and naturally leads to the concept of entropy. The paradigms we will see apply the golden rule in very different ways — assigning shorter codewords to frequent symbols, replacing entire repeated substrings with compact pointers, or reorganizing the data to make repetitions more visible — but the question that unites them remains always the same: how low can the golden rule go, in principle?

## Entropy

So far we have introduced the tools to describe and measure a compression algorithm, but not yet a way to say whether it is *good*. Is it possible, at least at a theoretical level, to establish whether a compression algorithm is optimal with respect to the space it occupies? Here we are not interested in the time limits of a compression/decompression scheme, but in whether the number of bits used by an encoder to compress a sequence is theoretically optimal, or whether one could do better. To answer this, we need to be able to compute the probability that a given symbol occurs at a given point in the sequence.

Let us start with the simplest case: the one in which each symbol is independent of the context. Suppose, then, that a source emits symbols $s \in \Sigma$ independently of one another. A probability distribution $p : \Sigma \to [0,1]$ is defined over $\Sigma$, where $p(s)$ represents the probability that the source emits symbol $s$ at each step. This function must clearly satisfy the condition

\[
\sum_{s \in \Sigma} p(s) =1
\]

Sources of this kind are called *memoryless*, since the production of one symbol in no way influences the production of the subsequent ones. We can now give a formal definition of entropy, in the simplest possible case, called **zero-order entropy**.

:::definition[Zero-Order Entropy]
Let $\Sigma$ be an alphabet of symbols, where every symbol is independent of all the others, and let $p$ be a probability distribution over $\Sigma$. The zero-order entropy is defined as

\[
\begin{equation}
    H_0 = \sum_{s \in \Sigma} p(s) \cdot \log_2 \frac{1}{p(s)} = -\sum_{s \in \Sigma} p(s)\log_2 p(s)
\end{equation}
\]
:::

:::observation
Zero-order entropy always satisfies $H_0 \geq 0$. This holds because every term in the sum is non-negative: since $p(s) \in [0,1]$ for every $s$, we have $\frac{1}{p(s)} \geq 1$, from which it follows that $\log_2\frac{1}{p(s)} \geq 0$.
:::

:::observation
We now ask when it is possible for $H_0 = 0$. Since all terms in the sum are non-negative, this can happen only if, for every $s \in \Sigma$, either $p(s) = 0$ or $p(s) = 1$. Since $p$ is a probability distribution — that is, the probabilities of the symbols must sum to 1 — this is possible only when there exists a single symbol $s'$ such that $p(s') = 1$, while all other symbols have probability zero:

\[
H_0 = 0 \iff \begin{cases} 
p(s) = 0 & \forall s \neq s' \\
p(s') = 1 & \end{cases}
\]

This situation is called a *constant distribution* (or *constant sequence*), since the source always emits the same symbol $s'$ with probability 1, generating a completely predictable sequence.
:::

:::observation
Zero-order entropy also satisfies the inequality $H_0 \leq \log_2|\Sigma|$, with equality when all symbols are equiprobable, i.e., when $p(s) = \frac{1}{|\Sigma|}$ for every $s \in \Sigma$. In this case we speak of a *fully random distribution*: every symbol is equally likely to occur, and the source is maximally unpredictable.
:::

The two preceding properties combine into a single result, $0 \leq H_0 \leq \log_2|\Sigma|$: the more skewed the distribution is toward a few symbols, the lower the entropy; the more balanced it is, the higher the entropy. The most predictable source has minimum entropy, the most chaotic one has maximum entropy.

:::figure[assets/img/binary_entropy_curve.svg]
**Figure 1.** Binary entropy function $H(p) = -p\log_2 p - (1-p)\log_2(1-p)$ for an alphabet $|\Sigma|=2$, with $p(s) = p$ and $p(\bar{s}) = 1-p$. The curve is bell-shaped: the maximum of 1 bit is reached at $p = 0.5$ (uniform distribution, maximum uncertainty), and the function equals $0$ at the endpoints $p \in \{0,1\}$ (degenerate distribution, absolute certainty).
:::

The term $-\log_2 p(s)$ is called the **information content** (or *surprise*) of symbol $s$, and measures how "surprising" it is to observe that symbol: if $s$ is highly probable, $p(s)$ is close to 1 and $-\log_2 p(s)$ is close to 0 — seeing $s$ occur tells us almost nothing new. If, instead, $s$ is rare, $p(s)$ is close to 0 and $-\log_2 p(s)$ becomes large — observing it carries much more information. In the limiting case, a symbol that occurs with certainty ($p(s)=1$) has zero information content ($-\log_2 1 = 0$): there is nothing to learn, since the outcome was already a foregone conclusion.

This quantity is also what determines the ideal codeword length: it is defined so that more probable events correspond to shorter codes, in line with the golden rule. Defining the random variable $X(s) = \log_2\frac{1}{p(s)}$, which assigns to each symbol its own information content, entropy can simply be rewritten as the expected value of the surprise associated with the symbols emitted by the source, that is, in other words, the average uncertainty of the source, weighted by the probability with which each symbol occurs. Indeed, by definition of expected value, we have

\[
\begin{equation}
\mathbb{E}[X] = \sum_{s \in \Sigma} p(s) \cdot X(s) = \sum_{s \in \Sigma} p(s) \cdot \log_2\frac{1}{p(s)} = H_0
\end{equation}
\]

which is exactly the definition of $H_0$ given above: this is not a coincidence, but simply a rewriting of the same sum.

This equality, however, has a crucial operational interpretation. If it were possible to assign each symbol $s$ a codeword of length exactly equal to its information content, $\ell(s) = \log_2\frac{1}{p(s)}$ bits, then the average codeword length — weighted by the frequency with which each symbol occurs in the source — would be exactly $H_0$. In other words, entropy $H_0$ represents the average number of bits per symbol needed to encode the source, under the (idealized) assumption that fractional, not necessarily integer, codeword lengths can be used. This observation directly links entropy to compression; a link made rigorous by the following result [@shannon1948].

:::theorem[Shannon, 1948]
For a discrete, memoryless source, the entropy $H_0$ represents the fundamental lower bound on the average number of bits needed to encode each symbol without loss of information, using a prefix-free compression algorithm $C$:
\[ 
\begin{equation}
    \mathbb{E}[C] \geq H_0 .
\end{equation}
\]
:::

Although the theorem is often stated in the context of prefix-free codes, the result is in fact more general and holds for any uniquely decodable code. Prefix-free codes are preferred in practice because they allow instantaneous, unambiguous decoding, while still being able to approach the entropy limit arbitrarily closely. The theorem is not merely an abstract bound: it is an *operational* result, since it also guarantees the existence of codes whose average length approaches $H_0$ arbitrarily closely — the limiting case, with fractional lengths $\ell(s) = \log_2\frac{1}{p(s)}$, cannot be realized with an integer number of bits, but constructions such as Huffman coding and Arithmetic coding, which we will see later, achieve or approach this limit [@cover2006].

In summary: if we knew exactly the probability distribution of a memoryless source, zero-order entropy would tell us precisely the minimum average number of bits per symbol needed to represent it without loss, and would guarantee that this limit is achievable. This is the first, fundamental answer to the question posed in the introduction.

:::example
Suppose $\Sigma = \{a, b, c\}$ with $p(a) = \tfrac{1}{4}$, $p(b) = \tfrac{1}{2}$, $p(c) = \tfrac{1}{4}$. Then

\[
H_0 = \tfrac{1}{4}\log_2 4 + \tfrac{1}{2}\log_2 2 + \tfrac{1}{4}\log_2 4 = \tfrac{1}{4}\cdot 2 + \tfrac{1}{2}\cdot 1 + \tfrac{1}{4}\cdot 2 = 1.5 \text{ bits/symbol}
\]

Let us compare this with a prefix-free encoding algorithm $C$. Suppose we encode the symbols as follows: $C(a) = 0$, $C(b) = 10$, $C(c) = 11$. Its expected average length is then

\[
\mathbb{E}[C] = \sum_{s} p(s)\,\ell(C(s)) = \tfrac{1}{4}\cdot 1 + \tfrac{1}{2}\cdot 2 + \tfrac{1}{4}\cdot 2 = 1.75 \text{ bits/symbol}
\]

The code $C$ uses 1.75 bits per symbol against a theoretical limit of 1.5, and is therefore not optimal: we can do better by swapping the lengths assigned to $a$ and $b$, since $b$ is the most probable symbol and deserves the shortest codeword — the golden rule at work once again. With the optimal assignment $C(b)=0,\ C(a)=10,\ C(c)=11$ we obtain exactly $\mathbb{E}[C] = 1.5 = H_0$.
:::

### k-th Order Entropy

The entropy presented so far rests on a strong assumption: $H_0$ requires every symbol to be independent of the preceding ones, which is almost never true for real data. In an English text, a Q is almost always followed by a U; in an executable file, certain byte sequences recur systematically; in a time series, the current value depends heavily on recent ones. Two sources can share the same marginal distribution $p(s)$ — and hence the same $H_0$ — while having completely different structures: one entirely random, the other strongly predictable from context. $H_0$, on its own, cannot tell them apart.

To address this problem, the concept is generalized by assuming that the probability of generating a symbol depends not only on the symbol itself but also on the $k$ most recently generated symbols — models known as **$k$-th order Markov models**. In this framework, the probability of generating $s_n \in \Sigma$ is expressed as a conditional probability $p(s_n \mid s_{n-k}, \dots, s_{n-1})$, where the sequence $w = (s_{n-k}, \dots, s_{n-1})$ is called the *context*.

:::definition[$k$-th Order Entropy]
Let $\Sigma$ be a finite alphabet and $S = (s_1, \dots, s_n)$ a sequence of symbols over $\Sigma$. For a fixed integer $k \geq 1$, the $k$-th order entropy is defined as

\[
\begin{equation}
    H_k = \sum_{w \in \Sigma^k} p(w) \sum_{s \in \Sigma} p(s \mid w) \cdot \log_2 \frac{1}{p(s \mid w)}
\end{equation}
\]

where $w = (s_{i-k}, \dots, s_{i-1})$ is a context of length $k$, $p(w)$ is the probability of observing that context, and $p(s \mid w)$ is the conditional probability of symbol $s$ given the context $w$.
:::

It can be shown that $H_k$ is non-increasing in $k$: knowing more context can only help (or, at worst, be irrelevant to) prediction. The **entropy of the source** (or *entropy rate*) is then defined as the limit
\[
    H = \lim_{k \to \infty} H_k .
\]

:::theorem[Generalization of Shannon's Theorem]
Let $C$ be an encoding scheme in which each symbol $s_n$ is encoded using a prefix-free code $C_w$ that depends on the context $w = (s_{n-k}, \dots, s_{n-1})$ of the $k$ preceding symbols — that is, for every possible context $w$, a different prefix-free code is used, built on the conditional distribution $p(\cdot \mid w)$. Then the average codeword length produced by $C$ satisfies

\[
\mathbb{E}[C] \geq H_k .
\]
:::

The result follows by applying Shannon's Theorem separately to each context. Fixing a context $w$, the conditional distribution $p(\cdot \mid w)$ is a genuine probability distribution, and the code $C_w$ cannot, on average, do better than its entropy: the average codeword length conditioned on context $w$ is at least $\sum_{s\in\Sigma} p(s\mid w)\log_2\frac{1}{p(s\mid w)}$. Averaging this inequality over all contexts $w$, weighted by the probability $p(w)$ of observing them, yields exactly $H_k$ on the right-hand side and $E[C]$ on the left.

This result rigorously confirms the intuition that motivated the introduction of $k$-th order entropy: conditioning the encoding on a longer context can only lower (or leave unchanged) the achievable theoretical compression limit, never raise it — consistent with the monotonicity of $H_k$ discussed above.

This is precisely the formal framework used by Claude Shannon in his celebrated experimental study of written English [@shannon1951], where he numerically estimated $H_0, H_1, H_2, H_3$ from tables of letter, digram, and trigram frequencies, observing their monotonic decrease (from 4.7 bits/letter for the uniform alphabet down to about 2.1 bits/letter when considering word frequencies) and hypothesizing, through an ingenious human-prediction experiment, that the limiting value $H$ for literary English lay between 0.6 and 1.3 bits/letter — a redundancy of roughly 75%. We will return to this latter experiment in a future article.

The practical problem, however, is evident: estimating $H_k$ requires reliable statistics on blocks of $k$ symbols, whose number grows as $|\Sigma|^k$. Already for moderate $k$, the number of possible contexts exceeds any available amount of data, and there are never enough observed occurrences to estimate the probabilities reliably — the sparsity problem. Counting explicit frequencies over long blocks, in short, does not scale: if we applied Huffman coding or Arithmetic coding directly to blocks of $k$ symbols instead of to single symbols, we would indeed obtain better compression (because dependencies between consecutive symbols are captured), but at the cost of an extended alphabet of size $|\Sigma|^k$ and a preamble that grows until it becomes prohibitive — a problem that is especially severe for Huffman coding, which must transmit the entire coding tree. This is precisely why, in practice, one prefers more sophisticated techniques based on adaptively estimated $k$-th order models, such as PPM, rather than explicit block counting.

The problem, in truth, is not only statistical in nature but also more deeply semantic. Low-order models such as bigrams and trigrams are relatively easy to estimate and capture local regularities well — the Q followed by U, certain frequent letter combinations in a language — but are unable to represent long-range dependencies: they capture properties tied to symbol frequency, not a genuine understanding of context. Increasing $k$ to capture deeper dependencies, as we have seen, causes the space of possible contexts — and with it the preamble needed to describe them — to explode. An effective compromise to this problem seems to have emerged only recently, with compression techniques based on neural models, capable of estimating conditional probabilities over long contexts without having to tabulate them explicitly. We will give a first glimpse of this later in this same article, leaving a more in-depth treatment to a dedicated article.

This is exactly the problem that the history of lossless compressors, which we will briefly present below, has tried to sidestep — in ways that are surprisingly different from one another, but always traceable back to the same question: how can the long-range structure of a source be exploited without having to explicitly count exponentially long blocks?

### Compression as Entropy Estimation

Before proceeding with the historical overview, it is worth making explicit a point that will run through all the following sections. Shannon's Theorem [@shannon1948] seen above holds under the assumption that the probability distribution of the source is *known*: only in that case is entropy an achievable compression limit. In practice, however, the true distribution is almost never known: a compressor must estimate it from the data itself, as it processes it.

This flips the perspective in a useful way. If a compressor estimates the source distribution well, it will approach the entropy limit; if the estimate is poor, it will move away from it. A good compressor is therefore, implicitly, also a good estimator of the source's entropy: if an algorithm compresses a text to 1.2 bits/character, that figure is also an estimate — more precisely, an upper bound — of the text's true entropy. Conversely, any progress in estimating a source's entropy tends to translate into a better compressor. Compression and entropy are, in this sense, two sides of the same coin — an equivalence rigorously formalized [@ornstein1993] and experimentally verified on natural text [@kontoyiannis1998]: it is this equivalence that will serve as the lens through which we read every paradigm in the next section.

## The Three Paradigms

What follows is a concise tour of the three major families of general-purpose lossless compression algorithms, viewed through the lens of entropy, plus a final bonus section on a glimpse of neural compressors. Each paradigm will, in the future, be given a dedicated, more in-depth article, in which the workings of individual algorithms will be treated in formal detail; here the goal remains to understand where each paradigm sits with respect to the notion of entropy, and which theoretical results guarantee — or limit — its optimality.

### Statistical Compressors

Statistical compressors are the approach most directly rooted in Shannon's theory, and they typically operate in two distinct phases: a **modeling** phase, in which statistical information about the input is gathered, followed by a **coding** phase, in which this information is used to encode each symbol into bits. The modeling phase can be carried out *offline* — with statistics gathered in a single pass over the input before encoding begins — or *online*, updating them symbol by symbol as they are used. In the simplest case, the zero-order one, modeling reduces to counting the frequency of each symbol in the input and using it as an estimate of the probability of the next symbol.

:::figure[assets/img/modeling_coding_schema.svg]
**Figure 2.** Pipeline of a statistical compressor (top) and the corresponding decompressor (bottom): the *modeling* phase estimates the probability distribution $p$ of the symbols — for instance via frequency counting or a $k$-th order Markov model — and the *coding* phase produces the compressed stream while minimizing expected length. In decompression, *modeling* and *decoding* must reproduce exactly the same estimates used during compression, building them incrementally from the symbols already decoded.
:::

Let us set the modeling side aside for a moment and focus on the coding side, where the two best-known algorithms are without doubt **Huffman coding** [@huffman1952] and **Arithmetic coding** [@rissanen1979].

Huffman coding builds a binary tree by iteratively merging the two least probable nodes into a new node, until a single tree is obtained; the root-to-leaf paths define the codewords, which are automatically prefix-free. The following result holds, quantifying exactly how far Huffman coding departs from the entropy limit [@huffman1952].

:::theorem[Huffman]
Let $H_0$ be the zero-order entropy of a source over an alphabet $\Sigma$, and let $L_H$ be the average length of the codewords produced by Huffman coding. Then $H_0 \leq L_H < H_0 + 1$.
:::

In other words, Huffman coding can lose at most one bit per symbol relative to the theoretical limit — an overhead that can be significant or negligible depending on the value of $H_0$. A variant known as **Canonical Huffman** produces an equivalent code that is more compact to store and transmit: instead of the entire tree, it suffices to know the length of each codeword.

Arithmetic coding, introduced by Elias and later formalized by Rissanen and Langdon [@rissanen1979], takes a different approach: instead of assigning a discrete codeword to each symbol, it represents the entire sequence as a single real number in the interval $[0,1)$, progressively narrowing a sub-interval based on the probabilities of the emitted symbols. Its advantage over Huffman coding is quantified by the following result [@rissanen1979][@witten1987].

:::theorem[Arithmetic coding]
The number of bits produced by Arithmetic coding for a sequence $S$ of $n$ symbols is at most $2 + nH_0$, where $H_0$ is the (empirical) entropy of $S$.
:::

The overhead is thus only two bits over the *entire* sequence, compared to one bit per symbol for Huffman coding — an advantage that is especially felt when $H_0$ is small. The price to pay is, in principle, the use of infinite-precision arithmetic; practical implementations use finite precision, accepting a slight degradation (on the order of $\frac{2}{100}n$ additional bits). The best-known practical implementation, due to Witten, Neal, and Cleary [@witten1987], is known as **range coding**: it preserves mathematical equivalence with Arithmetic coding but operates on integer-precision sub-intervals, making it far more efficient in practice. More recently, **Asymmetric Numeral Systems (ANS)** [@duda2009] have offered an even faster alternative, combining the compression efficiency of Arithmetic coding with a table-based encoding that avoids costly arithmetic operations altogether; a variant known as **range ANS (rANS)** is nowadays widely used in modern general-purpose compressors, including the entropy-coding stage of `zstd`.

Let us return now to the modeling phase, left in suspense earlier. The simplest way to estimate the probability of a symbol is to count its frequency — offline, over the entire sequence before compressing, or online, updating it incrementally — and this holds both for single symbols and for bigrams, trigrams, and so on. This is an elementary approach that works well when paired with coders such as Arithmetic coding or Huffman coding, but it is certainly not the only way to estimate symbol probabilities. A case particularly relevant for future articles in this series is one in which the modeling phase estimates probabilities conditioned on a variable-length context — this is the case of the **Prediction by Partial Matching (PPM)** family [@cleary1984], which falls back to shorter contexts when longer ones lack sufficient statistics, thereby directly addressing the sparsity problem. An interesting limiting case, which will deserve a dedicated article, is one in which the modeling phase does not estimate explicit probabilities at all — or rather, it does estimate them, but then uses them to produce a ranking of candidate symbols from most to least probable — hence the name *symbol ranking*. This idea originates as a human experiment in the very same 1951 study by Shannon, and would remain without an automatic algorithmic implementation for over forty years, until the work of Fenwick [@fenwick1996][@fenwick1997].

In all of these cases, the link with entropy remains almost by construction: the better the model approximates the true $p(s \mid w)$, the closer the coding length achieved by a good entropy coder gets to $H_k$. The practical bottleneck is almost never the coding phase — Huffman coding and Arithmetic coding are both provably close to optimal — but the modeling phase: estimating long contexts well from limited data remains the open problem.

### Dictionary-Based Compressors

A radically different approach avoids explicitly estimating a probability distribution altogether, exploiting instead repetitions and recurring patterns in the input sequence. The idea is to build a dictionary of substrings of $S$ and replace subsequent occurrences of those substrings with compact tokens referring to the dictionary entries — a strategy that is particularly effective when the data exhibits repeated substrings (a property common to both text and binary files), and that requires no prior knowledge of the source distribution.

Almost all modern dictionary-based compressors are built on an idea introduced in 1977 by Ziv and Lempel [@ziv1977], known as **LZ77**, in which the dictionary is built dynamically as the input is processed, using a sliding search window $W$ (containing the already encoded portion of $S$) and a lookahead buffer $B$ (the next segment to be encoded). Scanning backward through $W$, the encoder searches for the longest prefix $\alpha$ of the lookahead buffer that also occurs in $W \cdot B$: if it finds one, it emits a triple $\langle d, |\alpha|, c\rangle$, where $d$ is the distance from the start of $B$, $|\alpha|$ is the length of the match, and $c$ is the symbol following $\alpha$; otherwise it emits $\langle 0, 0, B[1]\rangle$. An elegant variant, **LZSS** [@storer1982], emits only pairs instead of triples, removing the need to explicitly encode the following symbol whenever a match exists. A year later, the same authors introduced **LZ78** [@ziv1978], which builds the dictionary incrementally by assigning identifiers to new phrases rather than referring to positions in the window: in practice, LZ77 became by far the most widely used, while LZ78 gradually fell into disuse, despite remaining faster (at the cost of a typically worse compression ratio).

:::figure[assets/img/lz77_example.svg]
**Figure 3.** Example of LZ77 encoding on the string $S = \texttt{aacaacabcabaaac}$ with search window $|W| = 6$ and lookahead buffer $|B| = 4$. Each row shows the state of the sliding window (in green), the match found in the lookahead buffer (in orange), and the literal symbol following the match (in red), together with the emitted token $\langle d, \ell, c \rangle$ — distance from the start of the buffer, match length, and literal character. At step 1 the dictionary is still empty and only the literal $\texttt{a}$ is emitted; in the following steps the encoder finds matches of increasing length, compressing the entire string into 5 tokens.
:::

LZ77, however, did not remain the algorithm used as-is in today's applications: countless variants have emerged from Ziv and Lempel's original idea. One of the most influential implementations is probably **gzip** [@deutsch1996], which replaces the slow linear scan of the window with dedicated data structures such as hash tables, and combines LZ77 with Huffman coding to encode literal symbols and match lengths within a unified alphabet. Other extensions have pushed in different directions: **LZMA** [@pavlov2007] (used in `7-Zip`) combines much larger search windows with more sophisticated entropy-coding schemes; **Brotli** [@brotli2016], developed by Google, supports both static and dynamic contexts; **LZ4** [@lz4] is optimized for speed; **Zstandard** (`zstd`) [@zstd2018], introduced by Facebook, balances speed and compression ratio in a highly configurable way and has become a de facto standard in modern applications — not by chance, its entropy-coding stage is itself based on a table-based variant of ANS (**tANS**), confirming just how pervasive the ANS family has become in practical compressors.

On the theoretical side, LZ77 and LZ78 enjoy optimality guarantees with respect to entropy, albeit of a different nature. Let us start with that of LZ78 [@ziv1978].

:::theorem[Asymptotic Optimality of LZ78, Ziv & Lempel 1978]
Let $S$ be a sequence generated by a stationary source with entropy rate $H$. As the length of $S$ grows, the compression ratio (in bits per symbol) produced by LZ78 converges to $H$: LZ78 is asymptotically optimal among finite-state compressors.
:::

More precisely, LZ78 is said to be *coarsely optimal*: its compression ratio approaches the $k$-th order entropy with a fixed additive gap, but it is not *$\rho$-optimal*, because the error is not proportional to $H_k$ and can therefore become significant when entropy is small. LZ77, although more effective in practice, does not achieve full optimality for high-order contexts — a non-asymptotic bound exists, however, independent of any probabilistic assumption on the source [@kosaraju1999].

:::theorem[Kosaraju & Manzini, 1999]
Let $s$ be a string of length $n$ over an alphabet $\Sigma$, and let $H_0(s)$ be its empirical zero-order entropy. The number of bits produced by LZ77 to compress $s$ is bounded by $8nH_0(s)$, up to lower-order terms.
:::

This is a "worst-case" result, in the spirit of the *individual-sequence* analysis introduced by Ziv and Lempel themselves: it holds for every string, without any assumption on the source that generated it.

### Block-Sorting Compressors

A third paradigm, introduced much later thanks to the **Burrows-Wheeler Transform (BWT)** [@burrows1994], works in a completely different way from the previous two. It should be stressed that the BWT is not, by itself, a compression algorithm, since it does not reduce the size of the input: it is rather a reversible permutation of the symbols of $S$, obtained by lexicographically sorting all cyclic rotations of the sequence, which reorganizes the input so as to group together occurrences of symbols that share the same context. Being a permutation, the transform is invertible by construction — a property indispensable for a BWT-based algorithm to guarantee lossless decompression. The construction of the BWT can be carried out in $O(n)$ time by exploiting the suffix array structure [@ferragina2023], the same complexity with which the original sequence can be reconstructed from its transform.

:::figure[assets/img/bwt_example.svg]
**Figure 4.** Computation of the BWT on the string $S = \texttt{BANANA\\\$} $ (the symbol $ \\\$ $ is the terminator, lexicographically smaller than every other symbol). Left: the 7 cyclic rotations of $S$ in the order in which they are constructed. Right: the same rotations sorted lexicographically — the first column (FC) is sorted by construction; the last column (BWT), highlighted in orange, is the output of the transform: $\texttt{BNN\\\$AAA}$. Row $i = 3$ of the sorted matrix coincides with the original string; this index is the *primary index* transmitted along with the BWT and required for decompression.
:::

By itself, the BWT does not produce compression: it must be combined with subsequent transforms, typically **Move-To-Front (MTF)** [@bentley1986] and **Run-Length Encoding (RLE)**. MTF replaces each symbol with its position in a dynamically updated list, then moves that symbol to the front of the list: the result is a sequence of typically small integers, well suited to being further compressed by an integer code (or by the statistical compressors seen above). RLE, applied after MTF, replaces long runs of identical symbols (typically zeros, after MTF) with length-symbol pairs. This combination — BWT, followed by MTF, followed by RLE, and finally by an entropy coder such as Huffman coding — underlies the **bzip** family of algorithms, among the best known and most widely used in practice: implementations such as `bzip2` partition the input into independent blocks (typically between 100 KB and 900 KB) and apply the entire pipeline separately to each block, hence the name *block-sorting*.

The link with entropy in this paradigm rests on one of the most solid and widely cited theoretical results in the entire analysis of compression [@manzini2001].

:::theorem[Manzini, 2001]
Let $s$ be a sequence of $n$ symbols over an alphabet $\Sigma$, and let $H_k(s)$ be its empirical $k$-th order entropy. There exists a family of BWT-based compressors (combined with MTF and a zero-order coder) such that, for every $k \geq 0$ **simultaneously**, the number of output bits produced is bounded by

\[
n \, H_k(s) \;+\; g_k(|\Sigma|)
\]

where $g_k(|\Sigma|)$ is a term that depends only on $k$ and on the alphabet size, not on $n$.
:::

This is a remarkable result: unlike classical statistical compressors, which must fix an order $k$ in advance (paying a sparsity cost if $k$ is too large), a BWT-based compressor performs well with respect to all orders simultaneously, without having to choose among them explicitly. This also explains an otherwise surprising empirical fact: if a statistical compressor that on its own achieves a compression ratio close to the zero-order entropy is preceded by a BWT stage, the overall process acts as a genuine *compression booster*, pushing the compression ratio from zero order all the way up to order $k$ — which is why `bzip2` can outperform both pure statistical compressors and, often, dictionary-based compressors such as `gzip`.

It is worth noting, as a direct point of contact with the predictive paradigm mentioned earlier when discussing the modeling phase of statistical compressors, that Fenwick [@fenwick1996] showed how block-sorting is, conceptually, another form of symbol ranking: the Move-To-Front transform applied after BWT sorting implicitly assigns ranks to symbols based on their recency within each context, exactly as a predictive symbol-ranking compressor does — explicitly and sequentially, rather than via permutation.

### A Glimpse of Neural Methods

The algorithms presented as representatives of the three paradigms — and the others not directly mentioned here — remain excellent lossless compressors, with results that are better or worse depending on the context, capable of balancing good predictive ability with excellent execution speed. In recent years, however, the rapid growth of digital archives — driven in large part by the need to gather ever more data to train artificial intelligence models — has made it necessary to find ever more efficient ways of compressing. The results offered by these standard compressors are increasingly insufficient: although they theoretically respect the limits imposed by entropy, the lack of good estimators of the probability distribution (in the case of statistical compressors), or the structural limits on sequences with few repetitions (in the case of dictionary-based or block-sorting compressors), push these results away from the true achievable optimum.

To address this problem, over the last decade the modeling phase of statistical compressors has increasingly been entrusted to neural networks, capable of estimating $p(s \mid w)$ for arbitrarily long contexts $w$, either by mixing the predictions of several models (as in the *context mixing* compressors of the PAQ family [@mahoney2005]) or through dedicated sequential architectures. The underlying principle remains identical to the one stated earlier: the cross-entropy of a model $Q$ with respect to the true distribution $p$ of the source, $H(p,Q) = -\sum_s p(s)\log_2 Q(s)$, always satisfies $H(p,Q) \geq H(p)$ — the direct generalization of Shannon's theorem to the case in which the model used for encoding does not exactly coincide with the true distribution of the source. Every estimate obtained through a model, neural or otherwise, is thus always an upper bound on the true entropy, never an exact measure, and this bound grows tighter the better the model is. The central point is that neural models manage to approach the true distribution of the source far more closely than standard methods do.

This equivalence between prediction and compression has been made explicit and empirical in recent times. Several recent works in the field of lossless compression — on text [@finezip2024][@alphazip2024], on source code [@nardone2026], and on other kinds of data such as video or images [@deletang2023] — show that large language models, used as predictors coupled with an arithmetic coder or embedded within a symbol-ranking pipeline, achieve compression ratios markedly better than those offered by general-purpose or data-specific specialized compressors: this is the natural closing of the circle opened by Shannon's human-prediction experiment in 1951. The drawback of these compressor families, however, remains their poor throughput, which still today severely limits their applicability in real-world settings.

### What Is Left Out

This article has focused on defining lossless compression and introducing entropy as a general limit for the compression of generic symbol sequences, typically text. There exist, however, families of data with their own structure for which more specific techniques are used, often not directly reducible to a single entropy value in the sense discussed here: this is the case of integer sequence coding (Elias codes, Golomb-Rice, Elias-Fano), designed for the particular distributions typical of applications such as posting lists in search engines, or of lossy compression techniques (in which a small loss of information is accepted) for images, audio, and video, where the relevant theoretical limit is no longer the entropy of the source but a different notion (the rate-distortion function). These topics deserve dedicated treatments, just as, for that matter, would the very algorithms only touched upon here. But this introductory article has already run long: it is best to close it here, and leave specific treatments to future articles.

## Conclusion

We started from a simple question: what does it mean to compress data without loss, and why do we do it? We have seen how lossless compression is not merely a practical problem of space and bandwidth, but also a problem with a precise theoretical limit — and that limit has a name: entropy. It is entropy that silently ties together families of algorithms that at first glance seem to have very little in common: a variable-length code built on a frequency table, a dictionary of repeated substrings, a lexicographic permutation of an entire text, or the weights of a neural network with billions of parameters. In every case, the problem is always the same — estimating, explicitly or implicitly, how predictable a source is — and every paradigm discussed in this article is, ultimately, a different answer to the same question posed in the introduction: how low can the golden rule go?

Future articles in this series will explore each paradigm only touched upon here individually, treating the workings of the respective algorithms in formal detail; this text remains the reference point they will return to in order to situate the discussed algorithm with respect to the notion of entropy.

## References

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