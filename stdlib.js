var runtime = require("./runtime.js");

var stdlib = {
    print: function (v) {
        process.stdout.write(runtime.to_string(v).value);
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
    }
};

Object.keys(stdlib).forEach(function (k) {
    stdlib[k] = runtime.function(stdlib[k]);
});

module.exports = stdlib;