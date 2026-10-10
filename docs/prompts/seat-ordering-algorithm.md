### Task: Generate Max-Distance Cyclic Stride Ordering

#### Objective

Generate a full permutation $P = [p_0, p_1, \dots, p_{N-1}]$ of the indices $\{1, \dots, N\}$ (or $\{0, \dots, N-1\}$) representing positions in a circular array of size $N$, such that:

1. Every slot is visited exactly once before repeating.
2. The circular distance between any consecutive elements $p_i$ and $p_{(i+1) \bmod N}$ is strictly maximized.
3. The circular distance between the final element $p_{N-1}$ and the initial element $p_0$ matches the consecutive step distance.

---

### Mathematical Principles

On a ring of size $N$, the circular distance between two positions $a$ and $b$ is:

$$\text{dist}_{\text{circ}}(a, b) = \min(\vert{}a - b\vert{}, N - \vert{}a - b\vert{})$$

The maximum theoretical distance across the ring diameter is:

$$D_{\max} = \left\lfloor \frac{N}{2} \right\rfloor$$

To generate a full cycle of length $N$ using a constant stride $s$, $s$ must be coprime to $N$:

$$\gcd(s, N) = 1$$

Because $s$ is constant, every step—including the circular wrap-around from $p_{N-1}$ to $p_0$—has an identical circular distance:

$$\Delta = \min(s, N - s)$$

---

### Algorithm Specification

1. **Calculate Maximum Theoretical Stride:**
   Set the target stride $s = \lfloor N / 2 \rfloor$.
2. **Find Largest Coprime Stride:**
   While $\gcd(s, N) \neq 1$, decrement $s$ by 1:

$$s \leftarrow s - 1$$

_(Since $\gcd(1, N) = 1$, this search always terminates with $s \ge 1$.)_ 3. **Generate Permutation (0-indexed):**
Given an arbitrary starting index $p_0 \in \{0, \dots, N-1\}$ (default $0$):

$$p_k = (p_0 + k \cdot s) \bmod N \quad \text{for } k = 0, 1, \dots, N-1$$

4. **Convert to 1-indexed (if required):**

$$P_{\text{1-based}} = [p + 1 \text{ for } p \in P]$$

---

### Reference Implementations

#### Python

```python
import math

def generate_max_distance_ring(n: int, start: int = 1) -> list[int]:
    # 1. Start from ring diameter
    stride = n // 2

    # 2. Find greatest stride coprime to n
    while math.gcd(stride, n) != 1:
        stride -= 1

    # 3. Generate cycle (1-indexed)
    start_idx = start - 1
    return [((start_idx + k * stride) % n) + 1 for k in range(n)]

```

#### TypeScript

```typescript
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function generateMaxDistanceRing(n: number, start: number = 1): number[] {
  let stride = Math.floor(n / 2)
  while (gcd(stride, n) !== 1) {
    stride--
  }

  const startIdx = start - 1
  const result: number[] = new Array(n)
  for (let k = 0; k < n; k++) {
    result[k] = ((startIdx + k * stride) % n) + 1
  }
  return result
}
```

---

### Stride & Distance Reference Table

| Ring Size $N$ | $\lfloor N/2 \rfloor$ | Selected Stride $s$ | Consecutive Circular Distance                                                  |
| ------------- | --------------------- | ------------------- | ------------------------------------------------------------------------------ |
| **8**         | 4                     | 3                   | 3                                                                              |
| **10**        | 5                     | 3                   | 3                                                                              |
| **12**        | 6                     | 5                   | 5                                                                              |
| **16**        | 8                     | 7                   | 7                                                                              |
| **20**        | 10                    | 9                   | 9                                                                              |
| **Odd $N$**   | $(N-1)/2$             | $(N-1)/2$           | $(N-1)/2$ _(Guaranteed optimal, as $\gcd(\frac{N-1}{2}, N) = 1$ always holds)_ |

---

This approach is similar to maximizing the physical distance between one allocated location and the locations allocated one before or one after in the sequence. But what if you wanted to maximize the difference between all three positions--i.e., not just the distance between x vs. x+1 and x vs x-1 in the sequence, but also x+1 vs x-1?

---

### Problem Analysis

For any element $x_i$ and its immediate neighbors $x_{i-1}$ and $x_{i+1}$, the three pairwise distances along the ring are:

- $d_1 = \text{dist}(x_{i-1}, x_i)$
- $d_2 = \text{dist}(x_i, x_{i+1})$
- $d_3 = \text{dist}(x_{i-1}, x_{i+1})$

In a constant-stride sequence $x_k = (x_0 + k \cdot s) \bmod N$:

- $d_1 = \min(s, N - s)$
- $d_2 = \min(s, N - s)$
- $d_3 = \min(2s, N - 2s)$

If you choose $s \approx N/2$ (like $s = 9$ for $N = 20$), $d_1 = 9$ and $d_2 = 9$, but $d_3 = \min(18, 2) = \mathbf{2}$. The two elements on either side of $x_i$ end up directly adjacent to each other on the ring.

To balance and maximize all three distances simultaneously, the three points $\{x_{i-1}, x_i, x_{i+1}\}$ should form an equilateral triangle around the ring—spaced roughly **$120^\circ$ ($\approx N/3$)** apart.

---

### Why the Simple Stride Fails Multi-Window Spacing

If you pick $s \approx N/3$ (e.g., $s = 7$ for $N = 20$):

- $d_1 = 7$
- $d_2 = 7$
- $d_3 = \min(14, 6) = 6$

While the 3-element window is balanced ($\min(d_1, d_2, d_3) = 6$), constant-stride generators have a rigid decay for larger windows: each step advances by the same fixed angle, eventually placing nearby time steps physically adjacent.

To maximize dispersion across **both 2-windows and 3-windows (and beyond)**, the optimal strategy uses **bit-reversal / quasirandom low-discrepancy sampling** (the golden-ratio circle map or van der Corput sequence), modified into a closed cycle.

---

### Strategy 1: The Balanced Constant Stride ($s \approx N/3$)

If you want a simple affine generator $x_k = (x_0 + k \cdot s) \bmod N$:

#### Objective

Maximize the worst-case pairwise distance in the 3-window:

$$\max_s \min\Big(\text{dist}(s),\, \text{dist}(2s)\Big) \quad \text{subject to } \gcd(s, N) = 1$$

Because $\text{dist}(s) + \text{dist}(2s) \le N - s$ in the first half-circle, the two distances balance when:

$$s \approx \frac{N}{3}$$

#### For $N = 20$:

Coprimes to 20 near $20/3 \approx 6.67$ are **7** and **13** (equivalent by reflection).

Using $s = 7$, start = 1:
**1, 8, 15, 2, 9, 16, 3, 10, 17, 4, 11, 18, 5, 12, 19, 6, 13, 20, 7, 14**

- **Adjacent distance ($x$ vs $x\pm 1$):** $\min(7, 13) = \mathbf{7}$
- **Two-step distance ($x-1$ vs $x+1$):** $\min(14, 6) = \mathbf{6}$
- **Minimum distance among any pair in any 3-consecutive window:** **6** (out of a theoretical geometric upper bound of $\lfloor 20/3 \rfloor = 6$).

---

### Strategy 2: Multi-Scale Hierarchical Halving (Optimal Dispersion)

When allocations stay active for more than 2–3 cycles, a hierarchical binary subdivision (generalized bit-reversal) guarantees that consecutive allocations bisect the largest open arcs on the ring.

For a power-of-2 size like $N = 16$, the sequence bisects the circle repeatedly:

1. Quarter 1: $0, 8$
2. Quarter 2: $4, 12$
3. Quarter 3: $2, 10, 6, 14$
4. Quarter 4: $1, 9, 5, 13, 3, 11, 7, 15$

Interleaving these so each step jumps across the circle while avoiding previous nodes:

$$P_{16} = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]$$

---

### Strategy Comparison for $N = 20$

| Metric                                          | Stride 9 (Original: 2-step focus) | Stride 7 (Balanced: 3-window focus)    |
| ----------------------------------------------- | --------------------------------- | -------------------------------------- |
| **$\vert{}x_{i+1} - x_i\vert{}$**               | **9**                             | **7**                                  |
| **$\vert{}x_{i+1} - x_{i-1}\vert{}$**           | **2** (poor)                      | **6** (near-maximal)                   |
| **Min distance in $\{x_{i-1}, x_i, x_{i+1}\}$** | **2**                             | **6**                                  |
| **Average distance in 3-window**                | $(9 + 9 + 2)/3 = \mathbf{6.67}$   | $(7 + 7 + 6)/3 = \mathbf{6.67}$        |
| **Worst-case bottleneck**                       | Extreme collision risk at step 2  | Evenly distributed equilateral spacing |

---

### LLM-Ready Algorithm Specification (Balanced 3-Window Stride)

```python
import math

def generate_3window_balanced_ring(n: int, start: int = 1) -> list[int]:
    """
    Generates a cyclic permutation of 1..N maximizing the minimum
    pairwise distance among any 3 consecutive allocations {x_{i-1}, x_i, x_{i+1}}.
    """
    target = n / 3.0

    # Candidate strides coprime to n, sorted by proximity to N/3
    coprimes = [s for s in range(1, n) if math.gcd(s, n) == 1]

    # Maximize min(dist(s), dist(2s))
    def score(s):
        d1 = min(s, n - s)
        d2 = min((2 * s) % n, n - ((2 * s) % n))
        return min(d1, d2)

    best_stride = max(coprimes, key=lambda s: (score(s), -abs(s - target)))

    start_idx = start - 1
    return [((start_idx + k * best_stride) % n) + 1 for k in range(n)]

```

If memory/storage lifetime spans $k$ allocations at once, set the target stride to $s \approx N / k$ with $\gcd(s, N) = 1$. For a sliding window of 3, **$s \approx N/3$** gives the optimal trade-off.

---

For 20, using hierarchical halving:

1, 11, 6, 16, 3, 13, 8, 18, 5, 15, 10, 20, 2, 12, 7, 17, 4, 14, 9, 19

---

### Task: Generate Hierarchical Halving Sequence for Arbitrary $N$

#### Objective

Generate a complete permutation $P = [p_0, p_1, \dots, p_{N-1}]$ of the positions $\{1, \dots, N\}$ (or $\{0, \dots, N-1\}$) arranged on a circular ring using recursive interval bisection. The ordering ensures:

1. Every slot is visited exactly once before repeating.
2. At any prefix length $K \le N$, the $K$ allocated points are spread uniformly around the circumference (low-discrepancy property).
3. Consecutive points interleave diametrically opposite hemispheres whenever possible to maximize short-term step distances while preserving multi-scale spatial dispersion.

---

### Mathematical Principle

The sequence is built by mapping points to fractional positions $\theta \in [0, 1)$ on the unit circle using a modified binary radical-inverse (van der Corput) sequence, then projecting those coordinates into the discrete grid of size $N$.

For an arbitrary $N$:

1. Find the smallest power of 2 bounding $N$:

$$M = 2^{\lceil \log_2 N \rceil}$$

2. Generate the classical bit-reversal sequence $B_k$ of length $M$, where index $k \in \{0, \dots, M-1\}$ with binary representation $(b_m \dots b_1)_2$ maps to the reversed bit integer $(b_1 \dots b_m)_2$.
3. Compute fractional ring coordinates:

$$\theta_k = \frac{\text{bit\_reverse}(k)}{M} \in [0, 1)$$

4. Sort the discrete ring positions $\{0, \dots, N-1\}$ by their corresponding canonical angles $\phi_j = \frac{j}{N}$ to match the hierarchy, or filter the standard bit-reversal projection:

$$x_k = \lfloor \theta_k \cdot N \rfloor$$

retaining only the first occurrence of each unique slot index in $\{0, \dots, N-1\}$.

---

### Algorithm Specification

1. **Initialize Parameters:**

- Given ring size $N \ge 1$.
- Set $M = 2^B$, where $B = \lceil \log_2 N \rceil$ (if $N = 1$, $B = 0$).

2. **Generate Virtual Bisection Tree:**

- Iterate $k$ from $0$ up to $M - 1$:
- Compute $r = \text{reverse\_bits}(k, B)$.
- Map $r$ to ring coordinate:

$$\text{pos} = \left\lfloor \frac{r \cdot N}{M} \right\rfloor$$

- If $\text{pos}$ has not yet been visited, append $\text{pos}$ to list $P$.

3. **Interleave Diametric Pairs (Hemisphere Hopping):**

- To ensure immediate step-to-step diametric jumping on non-powers of 2, partition candidates into base points and their antipodal companions:
- For each root interval $[a, b]$, emit midpoint $m = \lfloor(a + b)/2\rfloor$, followed immediately by its opposite point $(m + \lfloor N/2 \rfloor) \bmod N$.
- Mark emitted positions as visited.

4. **Output Format:**

- Add 1 to each index for 1-based indexing if requested:

$$P_{\text{1-based}} = [p + 1 \text{ for } p \in P]$$

---

### Reference Implementations

#### Python (General Arbitrary $N$)

```python
def hierarchical_halving_ring(n: int, start: int = 1) -> list[int]:
    """
    Generates a hierarchical halving permutation of positions 1..N.
    Uses interval-queue bisection paired with antipodal reflection.
    """
    if n <= 0:
        return []
    if n == 1:
        return [start]

    visited = [False] * n
    result = []

    def add_point(idx: int):
        idx_mod = idx % n
        if not visited[idx_mod]:
            visited[idx_mod] = True
            result.append(idx_mod)

    # 1. Place origin and antipodal point
    half = n // 2
    add_point(0)
    add_point(half)

    # 2. Queue stores open intervals (start, end) on the ring
    # Initial two halves of the ring
    queue = [(0, half), (half, n)]

    while len(result) < n and queue:
        start_pt, end_pt = queue.pop(0)

        # Calculate midpoint in index space
        mid = (start_pt + end_pt) // 2

        if mid != start_pt and mid != end_pt:
            # Add primary midpoint
            add_point(mid)
            # Add antipodal counterpart to preserve diameter jumps
            add_point(mid + half)

            # Enqueue left and right sub-intervals
            queue.append((start_pt, mid))
            queue.append((mid, end_pt))

    # Shift sequence to begin at the requested 1-based start position
    offset = start - 1
    return [((p + offset) % n) + 1 for p in result]

```

#### TypeScript

```typescript
function hierarchicalHalvingRing(n: number, start: number = 1): number[] {
  if (n <= 0) return []
  if (n === 1) return [start]

  const visited = new Uint8Array(n)
  const result: number[] = []
  const half = Math.floor(n / 2)

  const addPoint = (idx: number) => {
    const m = ((idx % n) + n) % n
    if (!visited[m]) {
      visited[m] = 1
      result.push(m)
    }
  }

  // Seed with origin and opposite point
  addPoint(0)
  addPoint(half)

  const queue: Array<[number, number]> = [
    [0, half],
    [half, n]
  ]

  while (result.length < n && queue.length > 0) {
    const [s, e] = queue.shift()!
    const mid = Math.floor((s + e) / 2)

    if (mid !== s && mid !== e) {
      addPoint(mid)
      addPoint(mid + half)

      queue.push([s, mid])
      queue.push([mid, e])
    }
  }

  const offset = start - 1
  return result.map((p) => ((p + offset) % n) + 1)
}
```

---

### Complexity & Edge Cases

- **Time Complexity:** $O(N)$ — every midpoint calculation runs in constant amortized time, visiting each position once.
- **Space Complexity:** $O(N)$ — tracking array `visited` of size $N$ and bounded BFS queue.
- **Odd $N$ Support:** When $N$ is odd, $\lfloor N/2 \rfloor$ breaks perfect antipodal symmetry by at most $\pm 0.5$ slots; the `visited` check drops redundant midpoints cleanly without deadlocking.
- **Power-of-2 Equivalence:** When $N = 2^B$, this produces the exact bit-reversal transversal with interleaved pairs:

$$\text{dist}(p_{2k}, p_{2k+1}) = \frac{N}{2}$$
