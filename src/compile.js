/* Copyright (c) 2017, Art Compiler LLC */
/* @flow */
var https = require('https');
var http = require('http');
var querystring = require("querystring");
import {assert, message, messages, reserveCodeRange} from "./assert.js"
reserveCodeRange(1000, 1999, "compile");
messages[1001] = "Node ID %1 not found in pool.";
messages[1002] = "Invalid tag in node with Node ID %1.";
messages[1003] = "No async callback provided.";
messages[1004] = "No visitor method defined for '%1'.";
function getGCHost() {
  const LOCAL = global.port === 5131;
  if (LOCAL) {
    return "localhost";
  } else {
    return "www.graffiticode.com";
  }
}
function getGCPort() {
  const LOCAL = global.port === 5131;
  if (LOCAL) {
    return "3000";
  } else {
    return "443";
  }
}
let transform = (function() {
  let table = [{
  }, {
    // v1
    "PROG" : program,
    "EXPRS" : exprs,
    "STR": str,
    "NUM": num,
    "IDENT": ident,
    "BOOL": bool,
    "LIST": list,
    "RECORD": record,
    "BINDING": binding,
    "ADD" : add,
    "MUL" : mul,
    "VAL" : val,
    "KEY" : key,
    "LEN" : len,
    "STYLE" : styleV1,
    "CONCAT" : concat,
    "ARG" : arg,
    "IN" : inData,
    "LAMBDA" : lambda,
    "PAREN" : paren,
    "SELECTALL" : selectAll,
    "FIELDS" : fields,
    "WHERE" : where,
    "QUERY" : query,
    "MAP" : map,
  }];
  let nodePool;
  let version;
  function getVersion(pool) {
    return pool.version ? +pool.version : 1;
  }
  function transform(code, data, resume) {
    nodePool = code;
    version = getVersion(code);
    return visit(code.root, data, resume);
  }
  function error(str, nid) {
    return {
      str: str,
      nid: nid,
    };
  }
  function get(data, cc) {
    var options = {
      method: "GET",
      host: getGCHost(),
      port: getGCPort(),
      path: "/items?" + querystring.stringify(data).trim().replace(/ /g, "+")
    };
    const LOCAL = global.port === 5131;
    const protocol = LOCAL ? http : https;
    var req = protocol.get(options, function(res) {
      var data = "";
      res.on('data', function (chunk) {
        data += chunk;
      }).on('end', function () {
        try {
          cc(JSON.parse(data));
        } catch (e) {
          console.log("parse error: " + data);
        }
      }).on("error", function () {
        console.log("error() status=" + res.statusCode + " data=" + data);
      });
    });
  }
  function visit(nid, options, resume) {
    assert(typeof resume === "function", message(1003));
    // Get the node from the pool of nodes.
    let node;
    if (typeof nid === "object") {
      node = nid;
    } else {
      node = nodePool[nid];
    }
    assert(node, message(1001, [nid]));
    assert(node.tag, message(1001, [nid]));
    assert(typeof table[version][node.tag] === "function", message(1004, [JSON.stringify(node.tag)]));
    return table[version][node.tag](node, options, resume);
  }
  // BEGIN VISITOR METHODS
  function str(node, options, resume) {
    let val = node.elts[0];
    resume([], val);
  }
  function num(node, options, resume) {
    let val = node.elts[0];
    resume([], +val);
  }
  function ident(node, options, resume) {
    let val = node.elts[0];
    resume([], val);
  }
  function bool(node, options, resume) {
    let val = node.elts[0];
    resume([], !!val);
  }
  function concat(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      let str = "";
      if (val1 instanceof Array) {
        val1.forEach(v => {
          str += v;
        });
      } else {
        str = val1.toString();
      }
      resume(err1, str);
    });
  }
  function paren(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      resume(err1, val1);
    });
  }
  function list(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node = {
          tag: "LIST",
          elts: node.elts.slice(1),
        };
        list(node, options, function (err2, val2) {
          let val = [].concat(val2);
          val.unshift(val1);
          resume([].concat(err1).concat(err2), val);
        });
      });
    } else if (node.elts && node.elts.length > 0) {
      visit(node.elts[0], options, function (err1, val1) {
        let val = [val1];
        resume([].concat(err1), val);
      });
    } else {
      resume([], []);
    }
  }
  function inData(node, options, resume) {
    let data = options.data ? options.data : [];
    resume([], data);
  }
  function arg(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      let key = val1;
      if (false) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      resume([].concat(err1), options.args[key]);
    });
  }
  function args(node, options, resume) {
    resume([], options.args);
  }
  function lambda(node, options, resume) {
    // Return a function value.
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), val2);
      });
    });
  }
  function selectAll(node, options, resume) {
    visit(node.elts[1], options, function (err1, val1) {
      visit(node.elts[0], options, function (err0, val0) {
        let val = fn(val0, val1);
        resume([].concat(err1).concat(err0), val);
      });
    });
    function fn(n, v, d) {
      let list = [];
      try {
        if (v instanceof Array) {
          v.forEach((v, i) => {
            list = list.concat(fn(n, v));
          });
        } else {
          let nn = [].concat(n);
          nn.forEach((n) => {
            if (v && v[n] !== undefined) {
              let d = {};
              d[n] = v[n];
              list.push(d);
            }
          })
          if (typeof v === "object") {
            // Traverse object children.
            Object.keys(v).forEach(k => {
              list = list.concat(fn(n, v[k]));
            });
          }
          let obj = {};
          list.forEach((o) => {
            obj = Object.assign(obj, o);
          });
          obj._data = d
          list = [obj];
        }
      } catch (x) {
        console.log(x.stack);
      }
      return list;
    }
  }
  function fields(node, options, resume) {
    visit(node.elts[1], options, function (err1, val1) {
      visit(node.elts[0], options, function (err0, val0) {
        val1.fields = val0;
        resume([].concat(err1).concat(err0), val1);
      });
    });
  }
  function where(node, options, resume) {
    visit(node.elts[0], options, function (err0, val0) {
      resume(err0, {
        where: val0
      });
    });
  }
  function query(node, options, resume) {
    visit(node.elts[0], options, function (err0, val0) {
      let query = {
        where: val0.where ? val0.where : "label='show'",
        fields: val0.fields ? val0.fields : ["obj"],
        limit: val0.limit ? val0.limit : "100",
      };
      get(query, (rows) => {
        let data = [];
        rows.forEach((r) => {
          try {
            if (r.obj) {
              r.obj = JSON.parse(r.obj);
            }
            data.push(r);
          } catch (x) {
            console.log("JSON parse error parsing: " + JSON.stringify(r.obj));
          }
        });
        resume([], data);
      });
    });
  }
  function map(node, options, resume) {
    visit(node.elts[1], options, function (err1, val1) {
      // args
      let errs = [];
      let vals = [];
      val1.forEach((val) => {
        options.args = [val];
        visit(node.elts[0], options, function (err0, val0) {
          vals.push(val0);
          errs = errs.concat(err0);
        });
      });
      resume(errs, vals);
    });
  }
  function binding(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), {key: val1, val: val2});
      });
    });
  }
  function record(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node = {
          tag: "RECORD",
          elts: node.elts.slice(1),
        };
        record(node, options, function (err2, val2) {
          val2[val1.key] = val1.val;
          resume([].concat(err1).concat(err2), val2);
        });
      });
    } else if (node.elts && node.elts.length > 0) {
      visit(node.elts[0], options, function (err1, val1) {
        let val = {};
        val[val1.key] = val1.val;
        resume([].concat(err1), val);
      });
    } else {
      resume([], {});
    }
  }
  function exprs(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node = {
          tag: "EXPRS",
          elts: node.elts.slice(1),
        };
        exprs(node, options, function (err2, val2) {
          let val = [].concat(val2);
          val.unshift(val1);
          resume([].concat(err1).concat(err2), val);
        });
      });
    } else if (node.elts && node.elts.length > 0) {
      visit(node.elts[0], options, function (err1, val1) {
        let val = [val1];
        resume([].concat(err1), val);
      });
    } else {
      resume([], []);
    }
  }
  function program(node, options, resume) {
    if (!options) {
      options = {};
    }
    visit(node.elts[0], options, function (err, val) {
      resume([].concat(err), val[val.length-1]);
    });
  }
  function key(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      let key = val1;
      if (false) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      visit(node.elts[1], options, function (err2, val2) {
        let obj = val2;
        if (false) {
          err2 = err2.concat(error("Argument must be a number.", node.elts[1]));
        }
        resume([].concat(err1).concat(err2), Object.keys(obj)[key]);
      });
    });
  }
  function val(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      let key = val1;
      if (false) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      visit(node.elts[1], options, function (err2, val2) {
        let obj = val2;
        if (false) {
          err2 = err2.concat(error("Argument must be a number.", node.elts[1]));
        }
        resume([].concat(err1).concat(err2), obj[key]);
      });
    });
  }
  function len(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      let obj = val1;
      if (false) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      resume([].concat(err1), obj.length);
    });
  }
  function add(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      val1 = +val1;
      if (isNaN(val1)) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      visit(node.elts[1], options, function (err2, val2) {
        val2 = +val2;
        if (isNaN(val2)) {
          err2 = err2.concat(error("Argument must be a number.", node.elts[1]));
        }
        resume([].concat(err1).concat(err2), val1 + val2);
      });
    });
  }
  function mul(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      val1 = +val1;
      if (isNaN(val1)) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      visit(node.elts[1], options, function (err2, val2) {
        val2 = +val2;
        if (isNaN(val2)) {
          err2 = err2.concat(error("Argument must be a number.", node.elts[1]));
        }
        resume([].concat(err1).concat(err2), val1 * val2);
      });
    });
  }
  function style(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), {
          value: val1,
          style: val2,
        });
      });
    });
  }
  function styleV1(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), {
          style: val1,
          value: val2,
        });
      });
    });
  }
  return transform;
})();
let render = (function() {
  function escapeXML(str) {
    return String(str)
      .replace(/&(?!\w+;)/g, "&amp;")
      .replace(/\n/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function render(val, resume) {
    // Do some rendering here.
    resume([], val);
  }
  return render;
})();
export let compiler = (function () {
  exports.version = "v1.0.0";
  exports.compile = function compile(code, data, resume) {
    // Compiler takes an AST in the form of a node pool and transforms it into
    // an object to be rendered on the client by the viewer for this language.
    if (!code) {      
      resume([], {});
    } else {
      try {
        let options = {
          data: data
        };
        transform(code, options, function (err, val) {
          if (err.length) {
            resume(err, val);
          } else {
            render(val, function (err, val) {
              resume(err, val);
            });
          }
        });
      } catch (x) {
        console.log("ERROR with code");
        console.log(x.stack);
        resume(["Compiler error"], {
          score: 0
        });
      }
    }
  }
})();
