var tokenize = require("./tokenizer.js");
var parser = require("./parser.js");
var codegen = require("./codegen.js");

console.log(codegen(`
    x := 05156151
    y := 05156151
    
    print([1, 2] == [1, 2])
    loop {
        break
    }
    print("\\n")
    print( [5 .. 10][-0] )
    print("\\n")
    
    print({x: 15, y: 26} == {x: 15, "y":26, x: 15})
    print("\\n")
`))

