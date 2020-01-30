Test implementation of my own programming language called **Haze**. It is for my thesis project. The code is messy, the later implementation will be written in Go.

Website: https://haze.codes/

Sample code in Haze:

```rust
is_prime := fn n {
    if type(n) != "number" || int(n) != n {
        fail "Wrong type"
    }
    if n < 0 {
        return is_prime(-n)
    }
    switch n {
    case 0, 1:
        return false
    case 2:
        return true
    }
    for d := [2 .. floor(sqrt(n)) + 1] {
        if n % d == 0 {
            return false
        }
    }
    return true
}
```