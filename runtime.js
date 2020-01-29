var immutable = require("./lib/immutable.min.js");
var big_float = require("./lib/big_float.js");

var runtime = {
    
    fail: function (v) {
        throw v;
    },
    
    // Values
    
    null: function () {
        return {
            type: "null"
        };
    },
    boolean: function (v) {
        return {
            type: "boolean",
            value: v
        };
    },
    number: function (str) {
        return {
            type: "number",
            value: big_float.make(str)
        };
    },
    string: function (str) {
        return {
            type: "string",
            value: str
        };
    },
    array: function (elems) {
        elems = elems || [];
        var list = immutable.List();
        elems.forEach(function (elem) {
            list = list.push(elem);
        });
        return {
            type: "array",
            value: list
        };
    },
    record: function (entries) {
        entries = entries || [];
        var map = immutable.OrderedMap();
        entries.forEach(function (entry) {
            map = map.set(entry[0], entry[1]);
        });
        return {
            type: "record",
            value: map
        };
    },
    function: function (js_func) {
        return {
            type: "function",
            value: js_func
        };
    },
    
    // Convert JS value to Haze value
    from_js: function (v) {
        var t = typeof v;
        if (v === null) {
            t = "null";
        }
        if (Array.isArray(v)) {
            t = "array";
        }
        switch (t) {
        case "null":
            return runtime.null();
        case "boolean":
            return runtime.boolean(v);
        case "number":
            return runtime.number(String(v));
        case "string":
            return runtime.string(v);
        case "array":
            var array = runtime.array();
            v.forEach(function (item) {
                array.value = array.value.push(runtime.from_js(item));
            });
            return array;
        case "object":
            var record = runtime.record();
            Object.keys(v).forEach(function (key) {
                record.value = record.value.set(key, runtime.from_js(v[key]));
            });
            return record;
        }
    },
    
    // Operations
    
    quote: function (source_string) {
        var str = "";
        source_string.split("").forEach(function (c) {
            if (c === "\t") {
                str += "\\t";
            } else if (c === "\r") {
                str += "\\r";
            } else if (c === "\n") {
                str += "\\n";
            } else if (c < ' ') {
                str += '\\u{' + Number(c.charCodeAt(0)).toString(16) + "}";
            } else if (c === '"') {
                str += '\\"';
            } else {
                str += c;
            }
        });
        return '"' + str + '"';
    },
    
    to_string: function (v, quote_string) {
        switch (v.type) {
        case "null":
            return runtime.string("null");
        case "boolean":
            return runtime.string(String(v.value));
        case "number":
            return runtime.string(big_float.string(v.value));
        case "string":
            if (quote_string) {
                return runtime.string(runtime.quote(v.value));
            } else {
                return v;
            }
        case "array":
            var str = "[";
            v.value.forEach(function (item) {
                if (str.length > 1) {
                    str += ", ";
                }
                str += runtime.to_string(item, true).value;
            });
            return runtime.string(str + "]");
        case "record":
            var str = "{";
            v.value.entrySeq().forEach(function (item) {
                if (str.length > 1) {
                    str += ", ";
                }
                var key = item[0];
                var value = item[1];
                if (key.match(/^[a-z](_?[a-zA-Z0-9]*)*$/g)) {
                    str += key + ": ";
                } else {
                    str += runtime.quote(key) + ": ";
                }
                str += runtime.to_string(value, true).value;
            });
            return runtime.string(str + "}");
        case "function":
            return runtime.string("(fn " + v.params.join("") + ")");
        }
    },
    
    concat: function (v1, v2) {
        v1 = runtime.to_string(v1);
        v2 = runtime.to_string(v2);
        return runtime.string(v1.value + v2.value);
    },
    
    equals: function (v1, v2) {
        if (v1.type !== v2.type) {
            return runtime.boolean(false);
        }
        switch (v1.type) {
        case "null":
        case "boolean":
        case "string":
            return runtime.boolean(v1.value === v2.value);
        case "number":
            return runtime.boolean(big_float.eq(v1.value, v2.value));
        case "array":
            if (v1.value.count() !== v2.value.count()) {
                return runtime.boolean(false);
            }
            var size = v1.value.count();
            var i;
            for (i = 0; i < size; i += 1) {
                if (!runtime.equals(v1.value.get(i), v2.value.get(i)).value) {
                    return runtime.boolean(false);
                }
            }
            return runtime.boolean(true);
        case "record":
            if (v1.value.count() !== v2.value.count()) {
                return runtime.boolean(false);
            }
            var size = v1.value.count();
            var sorted_v1 = v1.value.sortBy(function (v, k) { return k; }, function (a, b) {
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    return 0;
                }
            });
            var sorted_v2 = v2.value.sortBy(function (v, k) { return k; }, function (a, b) {
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    return 0;
                }
            });
            var entries_v1 = sorted_v1.entrySeq();
            var entries_v2 = sorted_v2.entrySeq();
            
            var i;
            for (i = 0; i < size; i += 1) {
                // console.log(entries_v1.get(i)[1], entries_v2.get(i)[1])
                if (!(entries_v1.get(i)[0] === entries_v2.get(i)[0] && runtime.equals(entries_v1.get(i)[1], entries_v2.get(i)[1]).value)) {
                    return runtime.boolean(false);
                }
            }
            return runtime.boolean(true);
        case "function":
            return v1.value === v2.value;
        }
    },
    not: function (v) {
        if (v.type !== "boolean") {
            return runtime.fail("Type error");
        }
        return runtime.boolean(!v.value);
    },
    lt: function (v1, v2) {
        if (v1.type === "number" && v2.type === "number") {
            return runtime.boolean(big_float.lt(v1.value, v2.value));
        }
        if (v1.type === "string" && v2.type === "string") {
            return runtime.boolean(v1.value < v2.value);
        }
        return runtime.fail("Type error");
    },
    ge: function (v1, v2) {
        return runtime.not(runtime.lt(v1, v2));
    },
    gt: function (v1, v2) {
        return runtime.lt(v2, v1);
    },
    le: function (v1, v2) {
        return runtime.not(runtime.gt(v1, v2));
    },
    neg: function (v) {
        if (v.type !== "number") {
            runtime.fail("Type error");
        }
        var n = runtime.number(0);
        n.value = big_float.neg(v.value);
        return n;
    },
    plus: function (v) {
        if (v.type !== "number") {
            runtime.fail("Type error");
        }
        return v;
    },
    add: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        return runtime.number(big_float.add(v1.value, v2.value));
    },
    sub: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        return runtime.number(big_float.sub(v1.value, v2.value));
    },
    mul: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        return runtime.number(big_float.mul(v1.value, v2.value));
    },
    div: function (v1, v2) {
        if (v1.type !== "number" || v2.type !== "number") {
            return runtime.fail("Type error.");
        }
        if (big_float.is_zero(v2.value)) {
            return runtime.null();
        }
        return runtime.number(big_float.div(v1.value, v2.value));
    },
    mod: function (v1, v2) {
        return runtime.number(
            big_float.sub(
                v1.value,
                big_float.mul(
                    v2.value,
                    big_float.floor(big_float.div(v1.value, v2.value))
                )
            )
        );
    },
    get: function (v, key) {
        if (v.type !== "string" && v.type !== "array" && v.type !== "record") {
            return runtime.fail("Type error.");
        }
        switch (v.type) {
        case "string":
            if (key.type !== "number") {
                return runtime.fail("Index must be a number");
            }
            if (!big_float.is_integer(key.value)) {
                return runtime.fail("Index must be an integer");
            }
            if (big_float.is_negative(key.value)) {
                return runtime.fail("Index cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.length) {
                return runtime.fail("Index out of range");
            }
            return runtime.number(v.value.charCodeAt(index));
        case "array":
            if (key.type !== "number") {
                return runtime.fail("Index must be a number");
            }
            if (!big_float.is_integer(key.value)) {
                return runtime.fail("Index must be an integer");
            }
            if (big_float.is_negative(key.value)) {
                return runtime.fail("Index cannot be negative");
            }
            var index = Number(big_float.string(key.value));
            if (index >= v.value.count()) {
                return runtime.fail("Index out of range");
            }
            return v.value.get(index);
        case "record":
            var str_key = runtime.to_string(key).value;
            var found_value = v.value.get(str_key);
            if (!found_value) {
                return runtime.null();
            }
            return found_value;
        default:
            return runtime.fail("Type error.");
        }
    },
    push: function (v, val) {
        if (from.type !== "array") {
            return runtime.fail("Must be an array");
        }
        var new_array = runtime.array();
        new_array.value = v.value.push(val);
        return new_array;
    },
    set: function (v, key) {
        
    },
    range: function (from, to) {
        if (from.type !== "number") {
            return runtime.fail("Must be a number");
        }
        if (!big_float.is_integer(from.value)) {
            return runtime.fail("Must be an integer");
        }
        if (to.type !== "number") {
            return runtime.fail("Must be a number");
        }
        if (!big_float.is_integer(to.value)) {
            return runtime.fail("Must be an integer");
        }
        var a = Number(runtime.to_string(from).value);
        var b = Number(runtime.to_string(to).value);
        var arr = [];
        var incr_by = 1;
        if (b < a) {
            incr_by = -1;
        }
        var len = Math.abs(b - a);
        if (len > 1000000) {
            return runtime.fail("Range is too large to be represented");
        }
        var current = a;
        if (len > 0) {
            while (true) {
                arr.push(a);
                if (arr.length === len) {
                    break;
                }
                a += incr_by;
            }
        }
        return runtime.from_js(arr);
    },
    call: function (f, args) {
        if (f.type !== "function") {
            return runtime.fail("Not a function");
        }
        return f.value.apply(null, args);
    },
    ensure_boolean: function (v) {
        if (v.type !== "boolean") {
            return runtime.fail("Not boolean");
        }
        return v.value;
    }
};

module.exports = runtime;

