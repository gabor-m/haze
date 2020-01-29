var parser = require("./parser.js");
var runtime = require("./runtime.js");
var stdlib = require("./stdlib.js");

function js_str(str) {
    return JSON.stringify([str]).slice(1, -1);
}

function codegen(tree) {
    // empty statement
    if (!tree) {
        return "";
    }
    // statement1 statement2 ...
    if (Array.isArray(tree)) {
        return (function () {
            var str = "";
            tree.forEach(function (item) {
                str += codegen(item) + "; ";
            });
            return str;
        }());
    }
    // 0156.78e-5
    if (tree.arity === "literal" && (tree.value === true || tree.value === false)) {
        return "$RUNTIME.boolean('" + tree.value + "')";
    }
    // 0156.78e-5
    if (tree.arity === "literal" && tree.subtype === "number") {
        return "$RUNTIME.number('" + tree.value + "')";
    }
    // "abcd"
    // 'abcd'
    if (tree.arity === "literal" && tree.subtype === "string") {
        return "$RUNTIME.string(" + js_str(tree.value) + ")";
    }
    // name
    if (tree.arity === "name") {
        return tree.value;
    }
    // name := expr
    if (tree.arity === "binary" && tree.value === ":=") {
        return (function () {
            var name = tree.first.value;
            var expression = codegen(tree.second);
            
            return "let " + name + " = " + expression + ";";
        }())
    }
    // a + b
    if (tree.arity === "binary" && tree.value === "+") {
        return "$RUNTIME.add(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a - b
    if (tree.arity === "binary" && tree.value === "-") {
        return "$RUNTIME.sub(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a * b
    if (tree.arity === "binary" && tree.value === "*") {
        return "$RUNTIME.mul(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a / b
    if (tree.arity === "binary" && tree.value === "*") {
        return "$RUNTIME.div(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a % b
    if (tree.arity === "binary" && tree.value === "%") {
        return "$RUNTIME.mod(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a ~ b
    if (tree.arity === "binary" && tree.value === "~") {
        return "$RUNTIME.concat(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a < b
    if (tree.arity === "binary" && tree.value === "<") {
        return "$RUNTIME.lt(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a > b
    if (tree.arity === "binary" && tree.value === ">") {
        return "$RUNTIME.gt(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a <= b
    if (tree.arity === "binary" && tree.value === "<=") {
        return "$RUNTIME.le(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a >= b
    if (tree.arity === "binary" && tree.value === ">=") {
        return "$RUNTIME.le(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a == b
    if (tree.arity === "binary" && tree.value === "==") {
        return "$RUNTIME.equals(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a != b
    if (tree.arity === "binary" && tree.value === "!=") {
        return "$RUNTIME.not($RUNTIME.equals(" + codegen(tree.first) + ", " + codegen(tree.second) + "))";
    }
    // return expr
    if (tree.arity === "statement" && tree.value === "return") {
        if (!tree.first) {
            return "return $RUNTIME.null();";
        }
        return "return " + codegen(tree.first) + ";";
    }
    // fail expr
    if (tree.arity === "statement" && tree.value === "fail") {
        if (!tree.first) {
            return "return $RUNTIME.fail($RUNTIME.null());";
        }
        return "return $RUNTIME.fail(" + codegen(tree.first) + ");";
    }
    // break
    if (tree.arity === "statement" && tree.value === "break") {
        return "break;";
    }
    // fn x, y (expr)
    // fn x, y { statements }
    if (tree.arity === "function" && tree.value === "fn") {
        return (function () {
            var params = [];
            tree.first.forEach(function (param) {
                params.push(param.value);
            });
            params = params.join(", ");
            if (Array.isArray(tree.second)) {
                return "$RUNTIME.function(function (" + params + ") { " + codegen(tree.second) + " })";
            } else {
                return "$RUNTIME.function(function (" + params + ") { return " + codegen(tree.second) + "; })";
            }
        }());
    }
    // f(5, 6)
    if (tree.arity === "binary" && tree.value === "(") {
        return (function () {
            var args = [];
            tree.second.forEach(function (item) {
                args.push(codegen(item));
            });
            return "$RUNTIME.call(" + codegen(tree.first) + ", [" + args.join(", ")  + "])";
        }());
    }
    // if expr { } else if expr { } else { }
    if (tree.arity === "statement" && tree.value === "if") {
        return (function () {
            var cond = codegen(tree.first);
            var true_branch = codegen(tree.second);
            var false_branch = codegen(tree.third);
            return "if ($RUNTIME.ensure_boolean(" + cond + ")) { " + true_branch  +" }" + (
                false_branch
                ? "else { " + false_branch + " }"
                : ""
            );
        }());
    }
    // loop { }
    if (tree.arity === "statement" && tree.value === "loop") {
        return "for (;;) { " + codegen(tree.second) + " }";
    }
    // while expr { }
    if (tree.arity === "statement" && tree.value === "while") {
        return "while (" + codegen(tree.first) +  ") { " + codegen(tree.second) + " }";
    }
    // [a .. b]
    if (tree.arity === "binary" && tree.value === "[" && tree.subtype === "range") {
        return "$RUNTIME.range(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // [a, b, c]
    if (tree.arity === "unary" && tree.value === "[") {
        return (function () {
            var elems = [];
            tree.first.forEach(function (elem) {
                elems.push(codegen(elem));
            });
            return "$RUNTIME.array([" + elems.join(", ") + "])";
        }());
    }
    
    // a[b]
    if (tree.arity === "binary" && tree.value === "[") {
        return "$RUNTIME.get(" + codegen(tree.first) + ", " + codegen(tree.second) + ")";
    }
    // a.n
    if (tree.arity === "binary" && tree.value === ".") {
        return "$RUNTIME.get(" + codegen(tree.first) + ", $RUNTIME.string(" + js_str(tree.second.value) + "))";
    }
    // -a
    if (tree.arity === "unary" && tree.value === "-") {
        return "$RUNTIME.neg(" + codegen(tree.first) + ")";
    }
    // +a
    if (tree.arity === "unary" && tree.value === "+") {
        return "$RUNTIME.plus(" + codegen(tree.first) + ")";
    }
    // !a
    if (tree.arity === "unary" && tree.value === "!") {
        return "$RUNTIME.not(" + codegen(tree.first) + ")";
    }
    // {x: 15, "a b": 26}
    if (tree.arity === "unary" && tree.value === "{") {
        return (function () {
            var code = "$RUNTIME.record([";
            code += tree.first.map(function (tree) {
                return "[" + js_str(tree.key) + ", " + codegen(tree) + "]";
                
            });
            return code + "])";
        }());
    }
    console.log("UNCATCHED TREE:");
    console.log(tree)
}

function generate_stdlib_names() {
    return Object.keys(stdlib).join(", ");
}

function generate_stdlib_values() {
    return Object.keys(stdlib).map(function (name) {
        return "$STDLIB." + name;
    }).join(", ");
    
}

module.exports = function (source) {
    var syntax_tree = parser(source);
    var js_code = codegen(syntax_tree);
    var $STDLIB = stdlib;
    var $RUNTIME = runtime;
    var $RETURN = runtime.null();
    var std_names = generate_stdlib_names();
    var std_vals = generate_stdlib_values();
    js_code = "$RETURN = (function (" + std_names + ") {" + js_code + " return $RUNTIME.null();}(" + std_vals + "));";
    console.log(js_code);
    eval(js_code);
    return $RETURN;
};

