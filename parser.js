var tokenizer = require("./tokenizer.js");
var stdlib = require("./stdlib.js");

function error(e) {
    throw e;
}

var make_parse = function (stdlib_names) {
    stdlib_names = stdlib_names || [];
    var scope;
    var symbol_table = {};
    var token;
    var tokens;
    var token_nr;

    var itself = function () {
        return this;
    };

    var original_scope = {
        define: function (n) {
            var t = this.def[n.value];
            if (typeof t === "object") {
                error((t.reserved)
                    ? "Already reserved."
                    : "Already defined.");
            }
            this.def[n.value] = n;
            n.reserved = false;
            n.nud = itself;
            n.led = null;
            n.std = null;
            n.lbp = 0;
            n.scope = scope;
            return n;
        },
        find: function (n) {
            var e = this;
            var o;
            while (true) {
                o = e.def[n];
                if (o && typeof o !== "function") {
                    return e.def[n];
                }
                e = e.parent;
                if (!e) {
                    o = symbol_table[n];
                    return (o && typeof o !== "function")
                        ? o
                        : symbol_table["(name)"];
                }
            }
        },
        pop: function () {
            scope = this.parent;
        },
        reserve: function (n) {
            if (n.arity !== "name" || n.reserved) {
                return;
            }
            var t = this.def[n.value];
            if (t) {
                if (t.reserved) {
                    return;
                }
                if (t.arity === "name") {
                    error("Already defined.");
                }
            }
            this.def[n.value] = n;
            n.reserved = true;
        }
    };

    var new_scope = function () {
        var s = scope;
        scope = Object.create(original_scope);
        scope.def = {};
        scope.parent = s;
        return scope;
    };

    var advance = function (id) {
        var a;
        var o;
        var t;
        var v;
        var subtype;
        if (id && token.id !== id) {
            error("Expected '" + id + "'.");
        }
        if (token_nr >= tokens.length) {
            token = symbol_table["(end)"];
            return;
        }
        t = tokens[token_nr];
        token_nr += 1;
        v = t.value;
        a = t.type;
        if (a === "name") {
            o = scope.find(v);
        } else if (a === "declaration") {
            o = symbol_table["(declaration)"];
            a = "declaration";
        } else if (a === "operator") {
            o = symbol_table[v];
            if (!o) {
                error("Unknown operator.");
            }
        } else if (a === "string" || a === "number") {
            subtype = a;
            o = symbol_table["(literal)"];
            a = "literal";
        } else {
            error("Unexpected token.");
        }
        token = Object.create(o);
        token.from = t.from;
        token.to = t.to;
        token.value = v;
        token.arity = a;
        token.subtype = subtype;
        return token;
    };

    var expression = function (rbp) {
        var left;
        var t = token;
        advance();
        left = t.nud();
        while (rbp < token.lbp) {
            t = token;
            advance();
            left = t.led(left);
        }
        return left;
    };

    var statement = function () {
        var n = token;
        var v;

        if (n.std) {
            advance();
            scope.reserve(n);
            return n.std();
        }
        v = expression(0);
        if ((!v.assignment && v.id !== "(") && v.id !== "@") {
            error("Bad expression statement.");
        }
        
        return v;
    };

    var statements = function () {
        var a = [];
        var s;
        while (true) {
            if (token.id === "}" || token.id === "(end)"
                    || (token.arity === "name" && token.value === "case")
                    || (token.arity === "name" && token.value === "default")) {
                break;
            }
            s = statement();
            if (s) {
                a.push(s);
            }
        }
        return a.length === 0
            ? null
            : a.length === 1
                ? a[0]
                : a;
    };

    var block = function () {
        var t = token;
        advance("{");
        return t.std();
    };

    var original_symbol = {
        nud: function () {
            error("Undefined: " + this.value);
        },
        led: function (ignore) {
            error("Missing operator.");
        }
    };

    var symbol = function (id, bp) {
        var s = symbol_table[id];
        bp = bp || 0;
        if (s) {
            if (bp >= s.lbp) {
                s.lbp = bp;
            }
        } else {
            s = Object.create(original_symbol);
            s.id = id;
            s.value = id;
            s.lbp = bp;
            symbol_table[id] = s;
        }
        return s;
    };

    var constant = function (s, v) {
        var x = symbol(s);
        x.nud = function () {
            scope.reserve(this);
            this.value = symbol_table[this.id].value;
            this.arity = "literal";
            return this;
        };
        x.value = v;
        return x;
    };

    var infix = function (id, bp, led) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp);
            this.arity = "binary";
            return this;
        };
        return s;
    };

    var infixr = function (id, bp, led) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp - 1);
            this.arity = "binary";
            return this;
        };
        return s;
    };

    var assignment = function (id) {
        return infixr(id, 10, function (left) {
            if (left.id !== "." && left.id !== "[" && left.arity !== "name") {
                error("Bad lvalue.");
            }
            this.first = left;
            this.second = expression(9);
            this.assignment = true;
            this.arity = "binary";
            return this;
        });
    };

    var prefix = function (id, nud) {
        var s = symbol(id);
        s.nud = nud || function () {
            scope.reserve(this);
            this.first = expression(70);
            this.arity = "unary";
            return this;
        };
        return s;
    };

    var stmt = function (s, f) {
        var x = symbol(s);
        x.std = f;
        return x;
    };

    symbol("(end)");
    symbol("(name)");
    symbol("(declaration)");
    
    symbol(":");
    symbol(";");
    symbol(")");
    symbol("]");
    symbol("}");
    symbol(",");
    symbol("..");
    symbol("else");
    symbol("case");
    symbol("default");
    
    constant("false", false);
    constant("true", true);
    constant("null", null);

    symbol("(literal)").nud = itself;

    assignment("=");
    assignment("+=");
    assignment("-=");
    assignment("~=");
    assignment("[]=");
    
    infix("?", 20, function (left) {
        this.first = left;
        this.second = expression(0);
        advance(":");
        this.third = expression(0);
        this.arity = "ternary";
        return this;
    });

    infixr("&&", 30);
    infixr("||", 30);
    infixr("??", 20);
 
    infixr("==", 40);
    infixr("!=", 40);
    infixr("<", 40);
    infixr("<=", 40);
    infixr(">", 40);
    infixr(">=", 40);

    infixr("~", 45);

    infix("+", 50);
    infix("-", 50);

    infix("*", 60);
    infix("/", 60);
    infix("%", 60);

    infix(".", 80, function (left) {
        this.first = left;
        if (token.arity !== "name") {
            error("Expected a property name.");
        }
        token.arity = "literal";
        this.second = token;
        this.arity = "binary";
        advance();
        return this;
    });

    infix("[", 80, function (left) {
        this.first = left;
        this.second = expression(0);
        this.arity = "binary";
        advance("]");
        return this;
    });

    infix("(", 80, function (left) {
        var a = [];
        if (left.id === "." || left.id === "[") {
            this.arity = "ternary";
            this.first = left.first;
            this.second = left.second;
            this.third = a;
        } else {
            this.arity = "binary";
            this.first = left;
            this.second = a;
            if ((left.arity !== "unary" || left.id !== "function") &&
                    left.arity !== "name" && left.id !== "(" &&
                    left.id !== "&&" && left.id !== "||" && left.id !== "?") {
                error("Expected a variable name.");
            }
        }
        if (token.id !== ")") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance(")");
        return this;
    });


    prefix("!");
    prefix("-");
    prefix("+");
    prefix("@");

    prefix("(", function () {
        var e = expression(0);
        advance(")");
        return e;
    });

    prefix("fn", function () {
        var a = [];
        new_scope();
        
        if (token.id !== "{" && token.id !== "(") {
            while (true) {
                if (token.arity !== "name") {
                    error("Expected a parameter name.");
                }
                scope.define(token);
                a.push(token);
                advance();
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        this.first = a;
        if (token.id === "{") {
            advance("{");
            this.second = statements();
            scope.pop();
            advance("}");
        } else if (token.id === "(") {
            advance("(");
            this.second = expression(0);
            scope.pop();
            advance(")");
        } else {
            error("Expected ( or {")
        }
        this.arity = "function";
        return this;
    });

    prefix("[", function () {
        var a = [];
        if (token.id !== "]") {
            while (true) {
                a.push(expression(0));
                if (a.length === 1 && token.id === "..") {
                    advance();
                    this.first = a[0];
                    this.second = expression(0);
                    this.arity = "binary";
                    this.subtype = "range";
                    advance("]");
                    
                    return this;
                }
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("]");
        this.first = a;
        this.arity = "unary";
        return this;
    });

    prefix("{", function () {
        var a = [];
        var n;
        var v;
        if (token.id !== "}") {
            while (true) {
                n = token;
                if (n.arity !== "name" && n.arity !== "literal") {
                    error("Bad property name.");
                }
                advance();
                if (token.id === ":") {
                    advance(":");                
                    v = expression(0);
                    v.key = n.value;
                    a.push(v);
                } else if (n.arity !== "name") {
                    error("Wrong property.");
                } else {
                    if (scope.find(n.value).value !== n.value) {
                        error("Undefined.");
                    }
                    n.key = n.value;
                    a.push(n);
                }
                if (token.id === "}" || token.id === "(end)") {
                    break;
                }
                if (token.id === ",") {
                    advance(","); // the comma is optional
                }
            }
        }
        advance("}");
        this.first = a;
        this.arity = "unary";
        return this;
    });


    stmt("{", function () {
        new_scope();
        var a = statements();
        scope.pop();
        advance("}");
        return a;
    });

    
    stmt("(declaration)", function () {
        var a = [];
        var n;
        var t;
        
        n = token;
        if (n.arity !== "name") {
            n.error("Expected a new variable name.");
        }
        scope.define(n);
        
        advance();
    
        t = token;
        advance("=");
        t.first = n;
        t.second = expression(0);
        t.arity = "binary";
        t.value = ":=";
        a.push(t);
       
        return (a.length === 0)
            ? null
            : (a.length === 1)
                ? a[0]
                : a;
    });
    
    stmt("if", function () {
        this.first = expression(0);
        this.second = block();
        if (token.id === "else") {
            scope.reserve(token);
            advance("else");
            this.third = (token.id === "if")
                ? statement()
                : block();
        } else {
            this.third = null;
        }
        this.arity = "statement";
        return this;
    });
    
    stmt("switch", function () {
        var cases = [];
        var default_case = null;
        this.first = expression(0);
        advance("{");
        
        while (true) {
            if (token.arity !== "name" || token.value !== "case") {
                error("Expected: case");
            }
            advance();
            var case_record = {
                cond: expression(0)
            };
            
            advance(":");
            new_scope();
            case_record.statements = statements();
            cases.push(case_record);
            scope.pop();
            if ((token.arity === "name" && token.value === "default") || token.id === "(end)" || token.id === "}") {
                break;
            }
        }
        
        if (token.arity === "name" && token.value === "default") {
            advance();
            advance(":");
            default_case = statements();
        }
        
        advance("}");
        
        this.arity = "case";
        this.cases = cases;
        return this;
    });
    
    stmt("return", function () {
        //if (token.id !== "}" && token.id !== "(end)") {
            this.first = expression(0);
        //}
        /*
        if (token.id !== "}" && token.id !== "(end)") {
            error("Unreachable statement.");
        }
        */
        this.arity = "statement";
        return this;
    });
    
    stmt("fail", function () {
        //if (token.id !== "}" && token.id !== "(end)") {
            this.first = expression(0);
        //}
        /*
        if (token.id !== "}" && token.id !== "(end)") {
            error("Unreachable statement.");
        }
        */
        this.arity = "statement";
        return this;
    });

    stmt("break", function () {
        /*
        if (token.id !== "}") {
            error("Unreachable statement.");
        }
        */
        this.arity = "statement";
        return this;
    });
    

    stmt("while", function () {
        this.first = expression(0);
        this.second = block();
        this.arity = "statement";
        return this;
    });
    
    stmt("loop", function () {
        this.first = null;
        this.second = block();
        this.arity = "statement";
        return this;
    });
    
    stmt("for", function () {
        this.first = this;
        advance("(declaration)");
        this.second = expression(0);
        this.second = block();
        this.arity = "statement";
    });

    return function (source) {
        tokens = tokenizer(source);
        token_nr = 0;
        scope = null;
        new_scope();
        stdlib_names.forEach(function (name) {
            scope.define({value: name}, true);
        });
        advance();
        var s = statements();
        advance("(end)");
        scope.pop();
        return s;
    };
};
module.exports = function (source) {
    return make_parse(Object.keys(stdlib))(source);
};