I recently released a **C++17 implementation** of the Bentley–McIlroy lossless compression algorithm on GitHub (available [here](https://github.com/Angelido/bentley_mcilroy)) [1].
Taking the opportunity, I would like to talk a bit about this algorithm: simple at its core, yet surprisingly elegant in the ideas that motivate it.

---

## Using Only Long Common Strings

The paper introducing the algorithm was published in 1999 under the title *Data Compression Using Long Common Strings* [2]. The core idea stems from a very precise observation: classical compression methods based on **sliding windows** — and in particular variants of [LZ77](https://en.wikipedia.org/wiki/LZ77_and_LZ78) [3] — search for repeated substrings only within a window of a few kilobytes. When two identical strings occur far apart in the text, these techniques end up treating them as completely independent, missing a significant compression opportunity.

The authors illustrate this limitation with a rather elegant experiment: they take the *United States Constitution* and the *King James Bible*, and compress both the original text and the version concatenated with itself. With `gzip` (one of the most widely used LZ77-based implementations), the doubled file is compressed to **almost twice the size of the original**. The reason is straightforward: the context window is too small to notice that the second half of the file is nearly identical to the first, so it is compressed almost from scratch, as if it were entirely new text.

The authors comment on this with a direct remark:

> *"Sliding windows do not find repeated strings that occur far apart in the input text. A major opportunity has been missed."*  
> — Bentley & McIlroy, 1999

Their proposal is therefore to take a different approach: instead of using a fixed-size context window, consider **the entire text as the context**. This immediately raises an efficiency concern: searching for every repetition over the entire text would be prohibitively slow and memory-intensive.

The proposed compromise is elegant: rather than finding *all* repeated substrings, focus only on those that are **long enough**. Some compression opportunities are intentionally sacrificed in order to guarantee:

- reasonable execution times
- bounded memory usage
- the entire text as the search context

In practice the algorithm works with **blocks of size** $b$, maintaining a compact data structure that stores the *fingerprints* of all disjoint blocks seen so far. If the file has length $n$, approximately $n/b$ fingerprints are stored — a drastic reduction compared to the $n$ possible substrings.

The choice of $b$ naturally introduces a trade-off: a small value may improve compression quality but increases memory use and execution time; a large value reduces computational cost but risks missing many short repetitions.

The following sections detail the main components of the algorithm, its guarantees, and its computational complexity. Examples are provided throughout to illustrate how each component works. The post concludes with a look at modern uses of this algorithm.

---

## The Algorithm

Let us now describe how the algorithm works. It scans the file to compress exactly once, left to right, maintaining a compact in-memory data structure updated incrementally. The only parameter is $b$, the block size in bytes. For each position $i$ in the text, the algorithm computes the fingerprint of the block $a[i-b+1 \ldots i]$ and:

- if $i$ is a multiple of $b$, stores the fingerprint in the hash table (`store`);
- in any case, checks whether that fingerprint is already present in the table (`checkformatch`).

The original pseudocode is the following:

```python
fp = fingerprint(a[0:b-1])
hash_table = {}
for i in range(b, n):
    if i % b == 0:
        store(fp, i)               # store canonical block fingerprint
    fp = roll(fp, a[i-b], a[i])   # slide the window
    checkformatch(fp, i)           # look for a match in the hash table
```

The two fundamental components are the *fingerprint* — which identifies each block compactly — and the *hash table* — which stores only disjoint blocks and allows matches to be found in constant time.
Let us examine both, before looking at how matches are handled.

### The Rabin–Karp Fingerprint

The central mechanism is the fingerprint: a numerical value associated with every window of $b$ consecutive characters, acting as a compact identifier. The idea is to assign to each block a numerical value such that equal blocks always have the same fingerprint, while distinct blocks have different fingerprints with high probability.

Bentley and McIlroy use the *Rabin–Karp fingerprint* [4]. Their choice is motivated by several reasons. The first is the simplicity of the construction: a sequence of $b$ characters is interpreted as the coefficients of a polynomial, evaluated modulo a large prime $p$. The formula is:

$$
\begin{equation}
F(a_i, \ldots, a_{i+b-1}) = \left( \sum_{j=0}^{b-1} a_{i+j} \cdot B^{b-1-j} \right) \bmod p
\end{equation}
$$

where $B$ is a suitably chosen integer base — typically a prime slightly larger than the alphabet size.

The main reason for this choice, however, is the crucial property the Rabin–Karp fingerprint enjoys: it can be **updated in $O(1)$** as the window slides by one symbol, without recomputing the polynomial from scratch. This operation is called `roll` and works intuitively: start from the current block's value, remove the contribution of the outgoing symbol, and add that of the incoming one. The formula is:

$$
\begin{equation}
F' = \bigl(F - a_{\text{out}} \cdot B^{b-1}\bigr) \cdot B + a_{\text{in}} \bmod p
\end{equation}
$$

This formula is why the algorithm is efficient: scanning the entire input and computing the fingerprint for every block requires $O(n)$ roll operations, each $O(1)$.

:::example
Let us see how the Rabin–Karp fingerprint and the roll operation work. For simplicity, take base $B = 10$, block size $b = 3$, and work with decimal digits instead of bytes. Consider the array `[4, 7, 2, 9]`.

The initial window of size $b$ is `[4, 7, 2]`. Using the fingerprint formula:

$$4 \cdot 10^2 + 7 \cdot 10 + 2 = 472$$

Now slide the window one step: `4` exits, `9` enters. Applying the roll formula:

$$F' = (472 - 4 \cdot 10^2) \cdot 10 + 9 = 72 \cdot 10 + 9 = 729$$

The result is $729 = 7 \cdot 10^2 + 2 \cdot 10 + 9$ — exactly the fingerprint of `[7, 2, 9]`, computed with just one subtraction, one multiplication, and one addition.
:::

Before closing this section, it is worth emphasising another important property of Rabin–Karp fingerprints: two distinct strings have different fingerprints with high probability. With a 32-bit fingerprint, the collision probability is approximately $2^{-32}$ — low enough for practical use. This means that if two blocks share the same fingerprint, they are very likely to be equal. A direct comparison is still always performed to rule out false positives, but in practice the number of unnecessary comparisons is negligible.

### The Data Structure

Reading the pseudocode above, one sees that a data structure is needed to handle two operations: `store` and `checkformatch`. The natural fit is a *hash table*. Let us look at how each operation works.

#### Store

The `store` operation populates the hash table. As already noted, it is invoked only on *canonical blocks* — those starting at positions that are multiples of $b$: the first block is $a[1 \ldots b]$, the second $a[b+1 \ldots 2b]$, and so on. Limiting storage to disjoint blocks keeps memory under control: for a file of $n$ bytes, approximately $n/b$ entries are stored.

For each stored block, a pair is inserted into the hash table: the Rabin–Karp fingerprint of the block, and a pointer to the start of the block. The insertion position is determined arithmetically from the fingerprint, so that equal fingerprints map to the same table slot. Collisions can be handled with standard strategies such as chaining or open addressing.

Knowing there are at most $n/b$ entries, a table of size between $n/b$ and $2n/b$ keeps the collision probability negligible.

#### Checkformatch

The `checkformatch` operation identifies potential matches. Unlike `store`, it is invoked at every step of the scan — not just on canonical blocks, but on all blocks of size $b$. For each current block, its fingerprint is computed, used to probe the hash table, and if the corresponding slot holds an entry with the *same* fingerprint, a *hit* is recorded.

The elegance of the design lies here: the direct string comparison — potentially expensive when the candidate block is far back in the file — is performed *only* on a hit. Since two distinct blocks are very unlikely to share a fingerprint, almost all expensive comparisons are avoided.

If the direct comparison confirms the match, the algorithm extends it both forward and backward:

- **Forward extension** — the two pointers advance together as long as symbols agree, with no length limit.
- **Backward extension** — the pointers step back, but by at most $b-1$ symbols. The limit is not arbitrary: if $b$ or more equal symbols existed to the left, at least one canonical block corresponding to the missed match would already be in the table — and the match would have been found in an earlier iteration.

### Output Encoding

At the end of the scan, every portion of the text is encoded in one of two ways:

- **Literal** — the byte is emitted as-is, because it was not part of any match.
- **Match** — the pair $\langle \text{pos},\, \text{len} \rangle$ is emitted, where $\text{pos}$ is the position in the original text where the matching string starts, and $\text{len}$ is the number of shared bytes.

The final output is thus a sequence of literals and matches. The more — and the longer — the matches, the better the compression.

:::example
Consider the following text with block size $b = 10$:

 ```txt
 the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog
 ```

 The text is clearly the same sentence repeated twice. We expect the compressor to detect this and encode it as a match.

What happens in practice: during the scan of the first 44 characters, no backward repetitions are found and all characters are emitted as literals. When the algorithm reaches the 45th character, the current block matches one already stored — and via forward extension, the entire second half is encoded as a single match:

```txt
the quick brown fox jumps over the lazy dog <1, 44>
```

The token `<1, 44>` means: *go to position 1, copy 44 symbols*.
:::

:::example
Consider a less regular text, with block size $b = 3$:

```
xyzabcdyzabcdplxxyzabq
```

Let us trace through the algorithm step by step.

- In the first 9 positions no match is found. The algorithm stores the three canonical blocks `xyz`, `abc`, and `dyz` in the hash table, and finds no hits during the non-canonical block scan.
- At position ten, the current block is `abc`, which is found in the hash table: a match is recorded. Backward extension finds two more common characters, widening the match to `yzabc`; forward extension finds one more, bringing it to `yzabcd`. The match starts at position 2 (1-based) and has length 6. The emitted match token is `<2, 6>`. The first 7 characters are emitted as literals.
- The scan continues without a match until the block `xyz` is found, already in the table. No new characters are found backward; forward extension finds two, giving a match of `xyzab`. The emitted match is `<1, 5>`.
- The remaining character `q` is emitted as a literal.

The final output is:

```
xyzabcd <2,6> plx <1,5> q
```

Let us verify by decoding each token:

| Token | Expansion |
|-------|-----------|
| `xyzabcd` | 7 literals |
| `<2, 6>` | pos. 2, 6 symbols → `yzabcd` |
| `plx` | 3 literals |
| `<1, 5>` | pos. 1, 5 symbols → `xyzab` |
| `q` | 1 literal |

Reconstructed: `xyzabcd` + `yzabcd` + `plx` + `xyzab` + `q` = `xyzabcdyzabcdplxxyzabq` ✓
:::

---

## Properties and Complexity

Having described the algorithm in full, we now ask: what properties make it interesting, and what advantages does it offer over more powerful methods such as LZ77-based compressors?

A natural first concern is: with a large block size $b$, are too many matches missed? The concern is legitimate, but Bentley and McIlroy show that all matches of length **greater than or equal to $2b-1$** are correctly identified. The reasoning is as follows: matches shorter than $b$ are never found; matches of length between $b$ and $2b-2$ may or may not be found depending on where the canonical block falls. However, for any repetition of length at least $2b-1$, it is guaranteed that at least one canonical block falls entirely within the repeated substring — and that block will be found by `checkformatch`. Forward and backward extension then reconstruct the full match.

This is a strong guarantee: no sufficiently long repetition is ever missed.

Another advantage over other approaches is that the search context is the **entire text**, not a fixed-size window. This is particularly useful when compressing files with long-range repetitions — exactly the case motivating this algorithm. And all of this without sacrificing efficiency: the time complexity is $O(n)$, due to the single scan and the $O(1)$ fingerprint updates. The space required is $O(n/b)$, determined by the number of canonical blocks stored in the hash table.

The table below summarises the complexity of the main operations:

| Operation | Complexity |
|---|---|
| Fingerprint initialisation | $O(b)$ |
| Fingerprint update (roll) | $O(1)$ per symbol |
| Full input scan | $O(n)$ |
| Hash table space | $O(n/b)$ |
| Guaranteed minimum match length | $\geq 2b - 1$ symbols |

Finally, it is worth noting that in practice $b$ is typically chosen not too small. The reasons are several: a small $b$ increases the number of canonical blocks to store, with a corresponding increase in both `store` time and hash table memory; with very small blocks, encoding a match can cost as much as — or more than — leaving the bytes as literals, cancelling out any compression benefit. And often the main goal is precisely to detect **macro-repetitions** — the long-range ones that classical compressors cannot capture — for which a moderately large $b$ is not just acceptable, but preferable.

---

## Modern Usage

The Bentley–McIlroy algorithm is interesting from several angles, but it must be said that in direct compression applications it is rarely used on its own: more mature and battle-tested methods are preferred, whether dictionary-based (`zstd`, `brotli`) or block-sorted (`bzip2`).

This does not mean the algorithm has stayed confined to academia. It is still used today, but in a different role: not as a standalone compressor, but as a **pre-compressor**. The idea is to use it in a first pass to identify and encode long-range macro-repetitions — the ones a standard compressor would miss — and then feed the output to a classical compressor that handles the local, finer-grained redundancies. This combination is particularly effective on highly redundant corpora: system logs, email archives, large source code repositories, XML databases.

But the most concrete legacy of the algorithm lies elsewhere: in the technique of Rabin–Karp fingerprints for identifying common strings between two distinct files, that is, in the **delta encoding** problem. The idea is simple: given two files — an old version and a new one — a delta encoder identifies the shared portions and represents the new version as a set of references to the old one, plus the changes. The result is a very compact representation of the difference, useful whenever one wants to transmit or store only what has changed.

One of the most concrete examples is [**open-vcdiff**](https://github.com/google/open-vcdiff) [5], Google's implementation of the [VCDIFF](https://datatracker.ietf.org/doc/html/rfc3284) format, an IETF standard for binary file delta encoding. In this context, the "source dictionary" is the previous version of the file and the "target text" is the updated version. The encoder — directly inspired by Bentley and McIlroy's ideas — uses Rabin–Karp fingerprints to efficiently identify common blocks between the two versions, without comparing every pair of positions. Long matches correspond to unchanged parts and are encoded as references; only the parts that actually changed are transmitted in full. Google uses this scheme, among other things, for software updates and large-scale file synchronisation: instead of downloading a complete new version, the client receives a compact delta and reconstructs the file locally.

---

## My Implementation

As mentioned at the outset, the occasion for writing this post came from releasing my **C++17** implementation, available on [GitHub](https://github.com/Angelido/bentley_mcilroy). This is a first version oriented towards clarity and correctness rather than maximum speed — written primarily for academic and study purposes.

To try it, clone and build with:

```bash
git clone https://github.com/Angelido/bentley_mcilroy.git
cd bentley_mcilroy
make
```

The repository includes a description of the code structure and instructions for testing it on simple text files. For completeness, the main components of the implementation are:

1. A rolling Rabin–Karp fingerprint (64-bit polynomial, exposed in the lower 32 bits) scans the input one symbol at a time.
2. At each canonical boundary (`position % b == 0`), the fingerprint is stored in a hash table with FIFO chains of depth $k$.
3. At each position, the hash table is probed for candidates. Each candidate is first compared by fingerprint, then verified with `memcmp` to eliminate false positives.
4. Confirmed matches are extended greedily: forward (unbounded) and backward (up to $b-1$ symbols).
5. A match is emitted only if its encoded cost — `FF 01` plus two LEB128 varints — is strictly less than the literal cost of the same bytes; otherwise the bytes are kept as literals.
6. The resulting token stream is serialised into the binary `.bm` format.

This is a first implementation and has several known limitations:

- **Single-threaded** — no parallelism between blocks.
- **Static compression** — the entire input is read into memory before processing begins; a streaming mode would reduce peak memory usage.
- **Encoding metadata** — the encoding field is saved in the `.bm` header and used only during compression to validate stride compatibility; it could be removed to save 1 byte per file.

Contributions and improvements are welcome via pull request.

---

## Conclusion

In this post we have seen how the Bentley–McIlroy compression algorithm works. It is a good example of how a simple idea — sampling fingerprints instead of comparing every position — can lead to a method that is both effective and practically useful. Its elegance lies in the balance between memory ($O(n/b)$), time ($O(n)$), and compression quality, all governed by a single parameter $b$, and in the use of rolling hashing as the tool that makes all of this possible without sacrificing simplicity.

It is not the most powerful algorithm in its domain, and it makes no claim to be. But it represents, in my view, an excellent entry point for anyone approaching the world of data compression: simple enough to be understood in its entirety, rich enough to raise interesting questions.

---

## References

1. **A. Nardone** — *Bentley–McIlroy Compressor (C++ Implementation)*, GitHub repository. (2026).
2. **J. Bentley, D. McIlroy** — *Data Compression Using Long Common Strings*, IEEE Data Compression Conference (DCC). (1999).
3. **J. Ziv, A. Lempel** — *A Universal Algorithm for Sequential Data Compression*, IEEE Transactions on Information Theory, 23(3). (1977).
4. **R. Karp, M. Rabin** — *Efficient Randomized Pattern-Matching Algorithms*, IBM Journal of Research and Development, 31(2). (1987).
5. **Google open-vcdiff** — [github.com/google/open-vcdiff](https://github.com/google/open-vcdiff)