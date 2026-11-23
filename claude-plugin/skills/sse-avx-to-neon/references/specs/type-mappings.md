# SSE/AVX → NEON Intrinsic Reference

## Table of Contents
1. [Arithmetic](#arithmetic)
2. [Bitwise Logic](#bitwise-logic)
3. [Shift](#shift)
4. [Compare](#compare)
5. [Min / Max / Abs](#min--max--abs)
6. [Load / Store](#load--store)
7. [Shuffle / Permute / Blend](#shuffle--permute--blend)
8. [Conversion / Cast](#conversion--cast)
9. [Horizontal Operations](#horizontal-operations)
10. [FMA & Advanced Float](#fma--advanced-float)
11. [Multi-step Recipes](#multi-step-recipes)

---

## Arithmetic

### Integer Add / Subtract
| SSE/AVX intrinsic | NEON intrinsic | Notes |
|---|---|---|
| `_mm_add_epi8` | `vaddq_s8` | |
| `_mm_add_epi16` | `vaddq_s16` | |
| `_mm_add_epi32` | `vaddq_s32` | |
| `_mm_add_epi64` | `vaddq_s64` | |
| `_mm_sub_epi8` | `vsubq_s8` | |
| `_mm_sub_epi16` | `vsubq_s16` | |
| `_mm_sub_epi32` | `vsubq_s32` | |
| `_mm_sub_epi64` | `vsubq_s64` | |
| `_mm_adds_epi8` | `vqaddq_s8` | saturating |
| `_mm_adds_epi16` | `vqaddq_s16` | saturating |
| `_mm_adds_epu8` | `vqaddq_u8` | saturating unsigned |
| `_mm_adds_epu16` | `vqaddq_u16` | saturating unsigned |
| `_mm_subs_epi8` | `vqsubq_s8` | saturating |
| `_mm_subs_epi16` | `vqsubq_s16` | saturating |
| `_mm_subs_epu8` | `vqsubq_u8` | saturating unsigned |
| `_mm_subs_epu16` | `vqsubq_u16` | saturating unsigned |

### Integer Multiply
| SSE/AVX intrinsic | NEON intrinsic | Notes |
|---|---|---|
| `_mm_mullo_epi16` | `vmulq_s16` | low 16 bits |
| `_mm_mullo_epi32` | `vmulq_s32` | low 32 bits |
| `_mm_mulhi_epi16` | see recipe | no direct equivalent |
| `_mm_mul_epu32` | `vmull_u32` | 32→64 widening; use lower half first |
| `_mm_madd_epi16` | see recipe | multiply-add with 16→32 widening |

### Float Arithmetic
| SSE/AVX intrinsic | NEON intrinsic | Notes |
|---|---|---|
| `_mm_add_ps` | `vaddq_f32` | |
| `_mm_sub_ps` | `vsubq_f32` | |
| `_mm_mul_ps` | `vmulq_f32` | |
| `_mm_div_ps` | `vdivq_f32` | A64V8 only; A32V7: reciprocal estimate + Newton-Raphson or scalar loop |
| `_mm_sqrt_ps` | `vsqrtq_f32` | A64V8; A32V7: `vrsqrteq_f32` + Newton steps |
| `_mm_rcp_ps` | `vrecpeq_f32` + Newton step | estimate only; two Newton-Raphson steps for full precision |
| `_mm_rsqrt_ps` | `vrsqrteq_f32` + Newton step | |
| `_mm_add_pd` | `vaddq_f64` | A64V8 only |
| `_mm_sub_pd` | `vsubq_f64` | A64V8 only |
| `_mm_mul_pd` | `vmulq_f64` | A64V8 only |
| `_mm_div_pd` | `vdivq_f64` | A64V8 only |

---

## Bitwise Logic

| SSE/AVX intrinsic | NEON intrinsic | Notes |
|---|---|---|
| `_mm_and_si128` | `vandq_s32` | use any integer lane type |
| `_mm_or_si128` | `vorrq_s32` | |
| `_mm_xor_si128` | `veorq_s32` | |
| `_mm_andnot_si128(a,b)` | `vandq_s32(vmvnq_s32(a_), b_)` | NOT(a) AND b |
| `_mm_and_ps` | `vandq_u32` + reinterpret | cast to uint32x4_t |
| `_mm_or_ps` | `vorrq_u32` + reinterpret | |
| `_mm_xor_ps` | `veorq_u32` + reinterpret | |
| `_mm_andnot_ps(a,b)` | `vandq_u32(vmvnq_u32(a_u32), b_u32)` | |

**Reinterpret pattern for float bitwise:**
```c
uint32x4_t a_u32 = vreinterpretq_u32_f32(a);
uint32x4_t b_u32 = vreinterpretq_u32_f32(b);
float32x4_t r = vreinterpretq_f32_u32(vorrq_u32(a_u32, b_u32));
```

---

## Shift

| SSE/AVX intrinsic | NEON intrinsic | Notes |
|---|---|---|
| `_mm_slli_epi16(a, n)` | `vshlq_n_s16(a, n)` | n must be compile-time constant |
| `_mm_slli_epi32(a, n)` | `vshlq_n_s32(a, n)` | |
| `_mm_slli_epi64(a, n)` | `vshlq_n_s64(a, n)` | |
| `_mm_srli_epi16(a, n)` | `vshrq_n_u16(a, n)` | logical; use unsigned type |
| `_mm_srli_epi32(a, n)` | `vshrq_n_u32(a, n)` | |
| `_mm_srli_epi64(a, n)` | `vshrq_n_u64(a, n)` | |
| `_mm_srai_epi16(a, n)` | `vshrq_n_s16(a, n)` | arithmetic; signed type |
| `_mm_srai_epi32(a, n)` | `vshrq_n_s32(a, n)` | |
| `_mm_sll_epi32(a, count)` | `vshlq_s32(a, vdupq_n_s32(count))` | variable shift |
| `_mm_srl_epi32(a, count)` | `vshlq_u32(a, vdupq_n_s32(-count))` | negate count for right shift |
| `_mm_sra_epi32(a, count)` | `vshlq_s32(a, vdupq_n_s32(-count))` | |

**Variable shift note:** NEON `vshlq_s32(a, b)` shifts left when b > 0, right when b < 0.

---

## Compare

NEON compare intrinsics return a **mask** (all-ones for true, all-zeros for false), matching SSE semantics. Cast with `vreinterpretq_s32_u32` to store in `neon_i32`.

| SSE/AVX intrinsic | NEON intrinsic | Result type |
|---|---|---|
| `_mm_cmpeq_epi8` | `vceqq_s8` → cast to `int8x16_t` | |
| `_mm_cmpeq_epi16` | `vceqq_s16` → cast | |
| `_mm_cmpeq_epi32` | `vceqq_s32` → cast | |
| `_mm_cmpgt_epi8` | `vcgtq_s8` → cast | |
| `_mm_cmpgt_epi16` | `vcgtq_s16` → cast | |
| `_mm_cmpgt_epi32` | `vcgtq_s32` → cast | |
| `_mm_cmplt_epi8` | `vcltq_s8` → cast | |
| `_mm_cmplt_epi32` | `vcltq_s32` → cast | |
| `_mm_cmpeq_ps` | `vceqq_f32` → cast to `float32x4_t` | |
| `_mm_cmplt_ps` | `vcltq_f32` → cast | |
| `_mm_cmpgt_ps` | `vcgtq_f32` → cast | |
| `_mm_cmpge_ps` | `vcgeq_f32` → cast | |
| `_mm_cmpneq_ps` | `vmvnq_u32(vceqq_f32(...))` → cast | no direct equivalent |
| `_mm_cmpord_ps` | `vandq_u32(vceqq_f32(a,a), vceqq_f32(b,b))` | both non-NaN |
| `_mm_cmpunord_ps` | `vorrq_u32(vmvnq_u32(vceqq_f32(a,a)), vmvnq_u32(vceqq_f32(b,b)))` | |

**Cast pattern:**
```c
r = vreinterpretq_s32_u32(vceqq_s32(a, b));
```

---

## Min / Max / Abs

| SSE/AVX intrinsic | NEON intrinsic |
|---|---|
| `_mm_min_epi8` | `vminq_s8` |
| `_mm_min_epi16` | `vminq_s16` |
| `_mm_min_epi32` | `vminq_s32` |
| `_mm_min_epu8` | `vminq_u8` |
| `_mm_min_epu16` | `vminq_u16` |
| `_mm_min_epu32` | `vminq_u32` |
| `_mm_max_epi8` | `vmaxq_s8` |
| `_mm_max_epi16` | `vmaxq_s16` |
| `_mm_max_epi32` | `vmaxq_s32` |
| `_mm_max_epu8` | `vmaxq_u8` |
| `_mm_max_epu16` | `vmaxq_u16` |
| `_mm_max_epu32` | `vmaxq_u32` |
| `_mm_min_ps` | `vminq_f32` |
| `_mm_max_ps` | `vmaxq_f32` |
| `_mm_min_pd` | `vminq_f64` (A64V8) |
| `_mm_max_pd` | `vmaxq_f64` (A64V8) |
| `_mm_abs_epi8` | `vabsq_s8` |
| `_mm_abs_epi16` | `vabsq_s16` |
| `_mm_abs_epi32` | `vabsq_s32` |

---

## Load / Store

| SSE/AVX intrinsic | NEON intrinsic |
|---|---|
| `_mm_load_si128(p)` | `vld1q_s32((int32_t*)(p))` |
| `_mm_loadu_si128(p)` | `vld1q_s32((int32_t*)(p))` (same; NEON handles unaligned) |
| `_mm_load_ps(p)` | `vld1q_f32(p)` |
| `_mm_loadu_ps(p)` | `vld1q_f32(p)` |
| `_mm_store_si128(p, a)` | `vst1q_s32((int32_t*)(p), a)` |
| `_mm_storeu_si128(p, a)` | `vst1q_s32((int32_t*)(p), a)` |
| `_mm_store_ps(p, a)` | `vst1q_f32(p, a)` |
| `_mm_storeu_ps(p, a)` | `vst1q_f32(p, a)` |
| `_mm_set1_epi8(v)` | `vdupq_n_s8(v)` |
| `_mm_set1_epi16(v)` | `vdupq_n_s16(v)` |
| `_mm_set1_epi32(v)` | `vdupq_n_s32(v)` |
| `_mm_set1_epi64x(v)` | `vdupq_n_s64(v)` |
| `_mm_set1_ps(v)` | `vdupq_n_f32(v)` |
| `_mm_setzero_si128()` | `vdupq_n_s32(0)` |
| `_mm_setzero_ps()` | `vdupq_n_f32(0.0f)` |

### Wide Struct (xN) Loads and Stores

NEON supports loading/storing 2, 3, or 4 consecutive vectors in a single instruction via struct types and `_x2`/`_x3`/`_x4` intrinsics. Use these for memory-bound loops processing sequential data instead of N individual `vld1q` calls:

| Struct type | Load intrinsic | Bytes loaded |
|---|---|---|
| `uint8x16x2_t` | `vld1q_u8_x2(ptr)` | 32 |
| `uint8x16x4_t` | `vld1q_u8_x4(ptr)` | 64 |
| `uint16x8x2_t` | `vld1q_u16_x2(ptr)` | 32 |
| `uint16x8x4_t` | `vld1q_u16_x4(ptr)` | 64 |
| `uint32x4x4_t` | `vld1q_u32_x4(ptr)` | 64 |
| `float32x4x4_t` | `vld1q_f32_x4(ptr)` | 64 |

Corresponding stores: `vst1q_u16_x4(ptr, val)`, `vst1q_f32_x4(ptr, val)`, etc.

Access individual vectors via `.val[0]` … `.val[3]`.

**`_ex` alignment-hint variants:** Some project NEON wrappers (e.g., zlib-ng's `neon_intrins.h`) define `_ex` variants that accept an alignment hint in bits:

```c
uint16x8x4_t p = vld1q_u16_x4_ex(table, 256);   // pointer is 32-byte aligned
vst1q_u16_x4_ex(table, p, 256);
```

Only use when the pointer is genuinely aligned to the stated boundary.

**xN batch operation pattern** (uniform operation over a large array):

```c
Z_REGISTER uint16x8_t v = vdupq_n_u16(wsize);   // broadcast scalar once
Z_REGISTER size_t n = entries / 32;              // 32 uint16_t per iteration
do {
    uint16x8x4_t p = vld1q_u16_x4_ex(table, 256);
    vqsubq_u16_x4_x1(p, p, v);                  // project macro: saturating sub all 4 lanes
    vst1q_u16_x4_ex(table, p, 256);
    table += 32;
} while (--n);
```

`Z_REGISTER` is a zlib-ng macro that expands to `register` on platforms that honour it — use on hot loop variables (`n`, `v`) to hint at register allocation.

---

## Shuffle / Permute / Blend

| SSE/AVX intrinsic | NEON approach |
|---|---|
| `_mm_shuffle_epi32(a, imm8)` | `__builtin_shufflevector` or manual `vgetq_lane_s32` / `vsetq_lane_s32` |
| `_mm_shufflelo_epi16` | Manual lane extract/insert |
| `_mm_shufflehi_epi16` | Manual lane extract/insert |
| `_mm_unpacklo_epi8` | `vzip1q_s8` (A64V8) or `vzipq_s8` (A32V7) + take lo |
| `_mm_unpackhi_epi8` | `vzip2q_s8` (A64V8) |
| `_mm_unpacklo_epi16` | `vzip1q_s16` |
| `_mm_unpackhi_epi16` | `vzip2q_s16` |
| `_mm_unpacklo_epi32` | `vzip1q_s32` |
| `_mm_unpackhi_epi32` | `vzip2q_s32` |
| `_mm_unpacklo_epi64` | `vcombine_s64(vget_low_s64(a), vget_low_s64(b))` |
| `_mm_unpackhi_epi64` | `vcombine_s64(vget_high_s64(a), vget_high_s64(b))` |
| `_mm_blend_epi16(a,b,mask)` | `vbslq_s16(mask_vec, b, a)` with precomputed lane mask |
| `_mm_blendv_epi8(a,b,mask)` | `vbslq_s8(mask, b, a)` |
| `_mm_blendv_ps(a,b,mask)` | `vbslq_f32(vreinterpretq_u32_f32(mask), b, a)` |

**Shuffle pattern (when no direct NEON equivalent):**
```c
int32x4_t r = vdupq_n_s32(0);
r = vsetq_lane_s32(vgetq_lane_s32(a, (imm8 >> 0) & 3), r, 0);
r = vsetq_lane_s32(vgetq_lane_s32(a, (imm8 >> 2) & 3), r, 1);
r = vsetq_lane_s32(vgetq_lane_s32(a, (imm8 >> 4) & 3), r, 2);
r = vsetq_lane_s32(vgetq_lane_s32(a, (imm8 >> 6) & 3), r, 3);
```

---

## Conversion / Cast

| SSE/AVX intrinsic | NEON intrinsic |
|---|---|
| `_mm_cvtepi32_ps` | `vcvtq_f32_s32` |
| `_mm_cvtps_epi32` | `vcvtnq_s32_f32` (round-to-nearest, A64V8) or `vcvtq_s32_f32` (truncate) |
| `_mm_cvttps_epi32` | `vcvtq_s32_f32` (truncate toward zero) |
| `_mm_cvtepi8_epi16` | `vmovl_s8(vget_low_s8(a_.neon_i8))` |
| `_mm_cvtepi8_epi32` | `vmovl_s16(vget_low_s16(vmovl_s8(vget_low_s8(a_.neon_i8))))` |
| `_mm_cvtepi16_epi32` | `vmovl_s16(vget_low_s16(a_.neon_i16))` |
| `_mm_cvtepi32_epi64` | `vmovl_s32(vget_low_s32(a_.neon_i32))` |
| `_mm_cvtepu8_epi16` | `vmovl_u8(vget_low_u8(a_.neon_u8))` |
| `_mm_cvtepu16_epi32` | `vmovl_u16(vget_low_u16(a_.neon_u16))` |
| `_mm_cvtepu32_epi64` | `vmovl_u32(vget_low_u32(a_.neon_u32))` |
| `_mm_cvtpd_ps` | `vcvt_f32_f64` (A64V8) |
| `_mm_cvtps_pd` | `vcvt_f64_f32` (A64V8) |
| `_mm_castsi128_ps(a)` | `vreinterpretq_f32_s32(a_.neon_i32)` |
| `_mm_castps_si128(a)` | `vreinterpretq_s32_f32(a_.neon_f32)` |

---

## Horizontal Operations

No direct NEON horizontal intrinsics for epi32 — use pairwise add:

| SSE/AVX intrinsic | NEON approach |
|---|---|
| `_mm_hadd_epi16` | `vpaddq_s16` (A64V8) or `vpadd_s16` (A32 half-width) |
| `_mm_hadd_epi32` | `vpaddq_s32` (A64V8) |
| `_mm_hadd_ps` | `vpaddq_f32` (A64V8) |
| `_mm_hsub_epi16` | no direct — compute via sub + vpaddq |
| `_mm_sad_epu8` | `vpaddlq_u8` chain |
| `_mm_movemask_epi8` | see recipe below |
| `_mm_movemask_ps` | see recipe below |

**movemask recipe (epi8):**
```c
// Extract MSB of each byte into bits of an integer result
uint8x16_t shifted = vshrq_n_u8(vreinterpretq_u8_s8(a), 7);  // MSB → bit 0
int mask = 0;
for (int i = 0; i < 16; i++)
    mask |= (vgetq_lane_u8(shifted, i) & 1) << i;
```

---

## FMA & Advanced Float

| SSE/AVX intrinsic | NEON intrinsic | Guard |
|---|---|---|
| `_mm_fmadd_ps(a,b,c)` | `vfmaq_f32(c, a, b)` | A32V8 or A64V8 |
| `_mm_fmsub_ps(a,b,c)` | `vfmaq_f32(vnegq_f32(c), a, b)` | A32V8 or A64V8 |
| `_mm_fnmadd_ps(a,b,c)` | `vfmsq_f32(c, a, b)` | A32V8 or A64V8 |
| `_mm_fmadd_pd(a,b,c)` | `vfmaq_f64(c, a, b)` | A64V8 |
| `_mm_floor_ps` | `vrndmq_f32` | A64V8; A32V7: scalar |
| `_mm_ceil_ps` | `vrndpq_f32` | A64V8 |
| `_mm_round_ps` | `vrndnq_f32` (nearest) | A64V8 |

---

## Multi-step Recipes

### `_mm_mulhi_epi16(a, b)` — high 16 bits of 16×16 multiply
```c
int32x4_t lo = vmull_s16(vget_low_s16(a),  vget_low_s16(b));
int32x4_t hi = vmull_s16(vget_high_s16(a), vget_high_s16(b));
int16x8_t r = vcombine_s16(vshrn_n_s32(lo, 16), vshrn_n_s32(hi, 16));
```

### `_mm_madd_epi16(a, b)` — multiply 16-bit pairs, add adjacent
```c
int32x4_t lo = vmull_s16(vget_low_s16(a),  vget_low_s16(b));
int32x4_t hi = vmull_s16(vget_high_s16(a), vget_high_s16(b));
// Pairwise add within each 32-bit result
int32x4_t r = vpaddq_s32(lo, hi);  // A64V8
// A32V7: use vpadd_s32 on low/high halves separately then vcombine
```

### `_mm_div_ps` on ARMv7 (Newton-Raphson reciprocal)
```c
float32x4_t recip = vrecpeq_f32(b);
recip = vmulq_f32(recip, vrecpsq_f32(b, recip));  // one NR step
recip = vmulq_f32(recip, vrecpsq_f32(b, recip));  // second NR step
float32x4_t r = vmulq_f32(a, recip);
```
