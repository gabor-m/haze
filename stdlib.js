var runtime = require("./runtime.js");
var big_float = require("./lib/big_float.js");

var stdlib = {
    type: function (v) {
        return runtime.string(v.type);
    },
    
    print: function (v) {
        process.stdout.write(runtime.to_string(v).value);
    },
    
    println: function (v) {
        process.stdout.write(runtime.to_string(v).value + "\n");
    },
    
    char: function (code) {
        if (code.type !== "number") {
            return runtime.fail("Char must be a number");
        }
        if (!big_float.is_integer(code.value)) {
            return runtime.fail("Char must be an integer");
        }
        if (big_float.is_negative(code.value)) {
            return runtime.fail("Char cannot be negative");
        }
        var val_js = code.value;
        if (val_js > 0xffff) {
            return runtime.fail("Char cannot be greater than " + String(0xffff));
        }
        return runtime.string(String.fromCharCode(val_js));
    },
    
    code: function (str) {
        if (str.type !== "string" || str.value.length == 0) {
            return runtime.fail("Must be a non empty string");
        }
        return runtime.number(str.value.charCodeAt(0));
    },
    
    count: function (v) {
        switch (v.type) {
        case "string":
            return runtime.number(v.value.length);
        case "array":
        case "record":
            return runtime.number(v.value.count());
        default:
            runtime.fail("Not countable");
        }
    },
    
    sqrt: function (n) {
        if (n.type !== "number") {
            return runtime.fail("Type error");
        }
        var result = Math.sqrt(n.value);
        if (!isFinite(result)) {
            return runtime.fail("Aithmetic error");
        }
        return runtime.number(result);
    },
    
    floor: function (n) {
        if (n.type !== "number") {
            return runtime.fail("Type error");
        }
        return runtime.number(Math.floor(n.value));
    },

    int: function (n) {
        if (n.type !== "number") {
            return runtime.fail("Type error");
        }
        return runtime.number(Math.floor(n.value));
    }
};

Object.keys(stdlib).forEach(function (k) {
    stdlib[k] = runtime.function(stdlib[k]);
});

module.exports = stdlib;
