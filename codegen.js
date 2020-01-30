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
    // false / true
    if (tree.arity === "literal" && (tree.value === null)) {
        return "$RUNTIME.null()";
    }
    // false / true
    if (tree.arity === "literal" && (tree.value === true || tree.value === false)) {
        return "$RUNTIME.boolean(" + String(tree.value) + ")";
    }
    // 0156.78e-5
    if (tree.arity === "literal" && tree.subtype === "number") {
        return "$RUNTIME.number(" + tree.value + ")";
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
            
            return "; let " + name + " = $RUNTIME.null(); " + name + " = " + expression + ";";
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
    if (tree.arity === "binary" && tree.value === "/") {
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
            return ";return $RUNTIME.null();";
        }
        return ";return " + codegen(tree.first) + ";";
    }
    // fail expr
    if (tree.arity === "statement" && tree.value === "fail") {
        if (!tree.first) {
            return ";return $RUNTIME.fail($RUNTIME.null());";
        }
        return ";return $RUNTIME.fail(" + codegen(tree.first) + ");";
    }
    // break
    if (tree.arity === "statement" && tree.value === "break") {
        return ";break;";
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
            return "; if ($RUNTIME.ensure_boolean(" + cond + ")) { " + true_branch  +" }" + (
                false_branch
                ? "else { " + false_branch + " }"
                : ""
            );
        }());
    }
    // loop { }
    if (tree.arity === "statement" && tree.value === "loop") {
        return "; while (true) { " + codegen(tree.second) + " }";
    }
    // while expr { }
    if (tree.arity === "statement" && tree.value === "while") {
        return "; while ($RUNTIME.ensure_boolean(" + codegen(tree.first) +  ")) { " + codegen(tree.second) + " }";
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
    // n = expr
    if (tree.arity === "binary" && tree.value === "=") {
        // console.log(JSON.stringify(tree, null, 2));
        return ";" + tree.first.value + " = " + codegen(tree.second) + ";";
    }
    // n += expr
    if (tree.arity === "binary" && tree.value === "+=") {
        return ";" + tree.first.value + " = $RUNTIME.add(" + tree.first.value + ", " + codegen(tree.second) + ");";
    }
    // n -= expr
    if (tree.arity === "binary" && tree.value === "-=") {
        return ";" + tree.first.value + " = $RUNTIME.sub(" + tree.first.value + ", "+ codegen(tree.second) + ");";
    }
    // n ~= expr
    if (tree.arity === "binary" && tree.value === "~=") {
        return ";" + tree.first.value + " = $RUNTIME.concat(" + tree.first.value + ", " + codegen(tree.second) + ");";
    }
    // n[] = expr
    if (tree.arity === "binary" && tree.value === "[]=") {
        return ";" + tree.first.value + " = $RUNTIME.push(" + tree.first.value + ", " + codegen(tree.second) + ");";
    }
    // a ? b : c
    if (tree.arity === "ternary" && tree.value === "?") {
        return (function () {
            var code = "(function () {";
            code += "if ($RUNTIME.ensure_boolean(" + codegen(tree.first) + ")) {"
            code += "return " + codegen(tree.second) + ";";
            code += "} else {";
            code += "return " + codegen(tree.third) + ";";
            code += "}";
            code += "}())";
            return code;
        }());
    }
    // a && b
    if (tree.arity === "binary" && tree.value === "&&") {
        return (function () {
            var code = "(function () { ";
            code += "if ($RUNTIME.ensure_boolean(" + codegen(tree.first) + ")) {"
            code += "return $RUNTIME.ensure_boolean(" + codegen(tree.second) + ", true);";
            code += "} else {";
            code += "return $RUNTIME.boolean('false')";
            code += "}";
            code += "}())";
            return code;
        }());
    }
    // a || b
    if (tree.arity === "binary" && tree.value === "||") {
        return (function () {
            var code = "(function () { ";
            code += "if ($RUNTIME.ensure_boolean(" + codegen(tree.first) + ")) {"
            code += "return $RUNTIME.boolean('true')";
            code += "} else {";
            code += "return $RUNTIME.ensure_boolean(" + codegen(tree.second) + ", true);";
            code += "}";
            code += "}())";
            return code;
        }());
    }
    // a ?? b
    if (tree.arity === "binary" && tree.value === "??") {
        return (function () {
            var code = "(function () { var $a = " + codegen(tree.first) + " ;";
            code += "if ($RUNTIME.equals($a, $RUNTIME.null()).value) {"
            code += "return " + codegen(tree.second) + ";";
            code += "} else {";
            code += "return $a;";
            code += "}";
            code += "}())";
            return code;
        }());
    }
    // switch e { case e, e: case e: default: }
    if (tree.arity === "case" && tree.value === "switch") {
        return (function () {
            var cond = codegen(tree.first);
            var switch_var_name = "$switch_" + String(Math.random()).replace(".", "");
            var str = "let " + switch_var_name + " = " + cond + ";";
            var first = true;
            tree.cases.forEach(function (case_record) {
                if (!first) {
                    str += " else ";
                }
                var conds = case_record.conds.map(function (cond) {
                    cond = codegen(cond);
                    return "$RUNTIME.equals(" + switch_var_name + ", " + cond + ").value";
                }).join("||");
                str += "if (" + conds + ") { " + codegen(case_record.statements) + " }";
            });
            if (tree.default_case) {
                str += " else { " + codegen(tree.default_case) + " }";
            }
            return str;
        }());
    }
    // @f(a, b)
    if (tree.arity === "unary" && tree.value === "@") {
        return "$RUNTIME.catch(function () { return " + codegen(tree.first) + "; })";
    }
    // for n := expr { }
    if (tree.arity === "statement" && tree.value === "for") {
        return (function () {
            var iterator_name = "$iter_" + String(Math.random()).replace(".", "");
            var code = "var " + iterator_name + " = $RUNTIME.iterator(" + codegen(tree.first) + ");";
            code += "while (" + iterator_name + ".has_next()) {";
            code += "let " + tree.var_name + " = " + iterator_name + ".next();";
            code += codegen(tree.second);
            code += "}";
            return code;
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
    var std_names = generate_stdlib_names();
    var std_vals = generate_stdlib_values();
    js_code = "$RETURN = (function (" + std_names + ") {" + js_code + " ; return $RUNTIME.null();}(" + std_vals + "));";
    return {
        code: js_code,
        eval: function () {
            var $STDLIB = stdlib;
            var $RUNTIME = runtime;
            var $RETURN = runtime.null();
            
            // console.log(js_code)
            
            eval(js_code);
            
            return $RETURN;;
        }
    }
};

