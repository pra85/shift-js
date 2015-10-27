var util = require('util');
var diff = require('deep-diff').diff;
var helpers = require('./helperFunctions.js');
var advance = require('./advance');
var newScope = require('./newScope');
var originalScope = require('./originalScope');
var originalSymbol = require('./originalSymbol');
var symbol = require('./symbol');
var block = require('./block');
var expression = require('./expression');
var infix = require('./infix');
var infixr = require('./infixr');
var assignment = require('./assignment');
var prefix = require('./prefix');
var stmt = require('./stmt');
var statements = require('./statements');
var statement = require('./statement');

var declarations = {
  symbols: function(state) {
    symbol(state, originalSymbol, "EOF");
    symbol(state, originalSymbol, "(end)");
    symbol(state, originalSymbol, "(name)");
    symbol(state, originalSymbol, ":");
    symbol(state, originalSymbol, ";");
    symbol(state, originalSymbol, ")");
    symbol(state, originalSymbol, "]");
    symbol(state, originalSymbol, "}");
    symbol(state, originalSymbol, ",");
    symbol(state, originalSymbol, "else");
    symbol(state, originalSymbol, "(literal)").nud = helpers.itself;
    symbol(state, originalSymbol, "this").nud = function() {
      state.scope.reserve(this);
      this.type = "this";
      return this;
    };
  },

  assignments: function(state) {
    assignment(state, "=");
    assignment(state, "+=");
    assignment(state, "-=");
    assignment(state, "*=");
    assignment(state, "/=");
  },

  infixes: function(state) {
    infix(state, "?", 20, function(left) {
      this.type = "ConditionalExpression";
      if(left.type === "IDENTIFIER") {
        left.type = "Identifier";
        left.name = left.value;
        delete left.value;
      }
      this.test = left;
      this.consequent = expression(state, 0);
      state = advance(state, ":");
      this.alternate = expression(state, 0);
      delete this.value;
      return this;
    });

    infixr(state, "&&", 30);
    infixr(state, "||", 30);
    infixr(state, "===", 40);
    infixr(state, "==", 40);
    infixr(state, "!==", 40);
    infixr(state, "!=", 40);
    infixr(state, "<", 40);
    infixr(state, "<=", 40);
    infixr(state, ">", 40);
    infixr(state, ">=", 40);
    infix(state, "+", 50);
    infix(state, "-", 50);
    infix(state, "*", 60);
    infix(state, "/", 60);
    infix(state, "%", 60);
    //infix(state, ".", 80, function(left) {
    //  this.first = left;
    //  if (state.token.type !== "name") {
    //    state.token.error("Expected a property name.");
    //  }
    //  state.token.type = "literal";
    //  this.second = state.token;
    //  state.type = "binary";
    //  state = advance(state);
    //  return state;
    //});

    infix(state, "[", 80, function(left) {
      this.type = "MemberExpression";
      this.computed = true;
      if(left.type === 'IDENTIFIER'){
        left.name = left.value;
        left.type = "Identifier";
        delete left.value;
      }
      this.object = left;
      this.property = expression(state, 0);
      delete this.value;
      state = advance(state, "]");
      return this;
    });

    //infix(state, "(", 80, function(left) {
    //  var a = [];
    //  if (left.id === "." || left.id === "[") {
    //    this.type = "ternary";
    //    this.first = left.first;
    //    this.second = left.second;
    //    this.third = a;
    //  } else {
    //    this.type = "binary";
    //    this.first = left;
    //    this.second = a;
    //    if ((left.type !== "unary" || left.id !== "function") &&
    //      left.type !== "name" && left.id !== "(" &&
    //      left.id !== "&&" && left.id !== "||" && left.id !== "?") {
    //      left.error("Expected a variable name.");
    //    }
    //  }
    //  if (state.token.id !== ")") {
    //    while (true) {
    //      a.push(expression(state, 0));
    //      if (state.token.id !== ",") {
    //        break;
    //      }
    //      state = advance(state, ",");
    //    }
    //  }
    //  state = advance(state, ")");
    //  return this;
    //});
  },

  prefixes: function(state) {
    prefix(state, "+");
    prefix(state, "!");
    prefix(state, "++");
    prefix(state, "--");
    prefix(state, "-");
    prefix(state, "typeof");

    prefix(state, "(", function() {
      var e = expression(state, 0);
      state = advance(state, ")");
      return e;
    });

    prefix(state, "function", function() {
      var a = [];
      state.scope = newScope(state, originalScope);
      if (state.token.type === "name") {
        state.scope.define(token);
        this.name = state.token.value;
        state = advance(state);
      }
      state = advance(state, "(");
      if (state.token.id !== ")") {
        while (true) {
          if (state.token.type !== "name") {
            state.token.error("Expected a parameter name.");
          }
          state.scope.define(token);
          a.push(state.token);
          state = advance(state);
          if (state.token.id !== ",") {
            break;
          }
          state = advance(state, ",");
        }
      }
      this.first = a;
      state = advance(state, ")");
      state = advance(state, "{");
      this.second = statements();
      state = advance(state, "}");
      this.type = "function";
      scope.pop();
      return this;
    });

    prefix(state, "[", function() {
      var a = [];
      if (state.token.id !== "]") {
        while (true) {
          a.push(expression(state, 0));
          if (state.token.id !== ",") {
            break;
          }
          state = advance(state, ",");
        }
      }
      state = advance(state, "]");
      this.type = "ArrayExpression";
      delete this.value;
      delete this.raw;
      this.elements = a;
      return this;
    });

    prefix(state, "{", function() {
      var a = [], n, v;
      var tmpLookAhead = state.tokens[state.index];
      if(tmpLookAhead.value === ",") {
        // Handle Tuples w/out keys
        var a = [];
        if (state.token.id !== "]") {
          while (true) {
            a.push(expression(state, 0));
            if (state.token.id !== ",") {
              break;
            }
            state = advance(state, ",");
          }
        }
        state = advance(state, ")");
        this.type = "ObjectExpression";
        delete this.value;
        delete this.raw;
        this.properties = [];
        for(var m=0; m<a.length; m++) {
          var currentValue = a[m];
          var kvMap = {};
          kvMap.type = "Property";
          kvMap.computed = false;
          kvMap.kind = 'init';
          kvMap.method = false;
          kvMap.shorthand = false;
          kvMap.key = {};
          kvMap.key.type = "Literal";
          var keyIndex = this.properties.length;
          kvMap.key.value = keyIndex;
          kvMap.key.raw = keyIndex.toString();
          kvMap.value = currentValue;
          this.properties.push(kvMap);
        }
        return this;
      }

      if ((state.token.id !== "]" &&  state.token.id !== ")") && tmpLookAhead.value !== ",") {
        while (true) {
          n = state.token;
          if (n.type !== "IDENTIFIER" && n.type !== "name" && n.type !== "literal" && n.type !== "TUPLE_ELEMENT_NAME") {
            state.token.error("Bad property name.");
          }
          state = advance(state);
          state = advance(state, ":");
          v = expression(state, 0);

          var kvMap = {};
          kvMap.type = "Property";
          kvMap.computed = false;
          kvMap.kind = 'init';
          kvMap.method = false;
          kvMap.shorthand = false;

          if (n.type === "literal" && helpers.isNum(n.value)) {
            n.type = "Literal";
            n.raw = n.value;
            if (n.value.indexOf('.')) {
              n.value = parseFloat(n.value);
            } else {
              n.value = parseInt(n.value);
            }
          } else if (n.type === "literal" && helpers.isBool(n.value)) {
            n.type = "Identifier";
            n.name = n.value;
            delete n.raw;
            delete n.value;
          } else if (n.type === "literal") {
            // This is for type string
            n.type = "Literal";
            n.raw = '"' + n.value + '"';
          } else if(n.type === "TUPLE_ELEMENT_NAME") {
            n.type = "Identifier";
            n.name = n.value;
            delete n.value;
          }
          kvMap.key = n;
          kvMap.value = v;

          /* a.push(v); */
          a.push(kvMap);

          if (state.token.id !== ",") {
            break;
          }
          state = advance(state, ",");
        }
      }

      try {
        state = advance(state, "]");
      } catch(e) {
        state = advance(state, ")");
      }

      this.type = "unary";
      delete this.value;
      this.type = "ObjectExpression";
      this.properties = a;
      return this;
    });
  },

  stmts: function(state) {
    stmt(state, "{", function() {
      state.scope = newScope(state, originalScope);
      var a = statements(state);
      state = advance(state, "}");
      state.scope.pop();
      return a;
    });

    stmt(state, "var", function() {
      var a = [], n, t;
      while (true) {
        n = state.token;
        if (n.type !== "IDENTIFIER") {
          n.error("Expected a new variable identifier.");
        } else {
          n.type = "Identifier";
          n.name = n.value;
        }

        state.scope.define(state, n);
        delete n.value;

        state = advance(state);
        if (state.token.id === "=") {
          t = state.token;
          state = advance(state, "=");

          t.type = 'VariableDeclaration';
          t.kind = 'var';
          t.declarations = [{
            type: 'VariableDeclarator',
            id: {},
            init: {}
          }];

          t.declarations[0].id = n; //TODO FIX
          t.declarations[0].init = expression(state, 0);
          delete t.value;

          a.push(t);
        }
        if (state.token.id === ";") {
          break;
          //return a.length === 0 ? null : a.length === 1 ? a[0] : a;
        }
        if (state.token.id !== ",") {
          break;
        }
        state = advance(state, ",");
      }
      if(state.token.value === "var") {
        return a.length === 0 ? null : a.length === 1 ? a[0] : a;
      }
      try {
        state = advance(state);
        //advance(";");//when actually was ("++")
      } catch (e) {
        state = advance(state, "EOF");
      }

      return a.length === 0 ? null : a.length === 1 ? a[0] : a;
    });

    stmt(state, "if", function() {
      if(state.tokens[state.index].value === "(") {
        state = advance(state, "(");
        this.test = expression(state, 0);
        state = advance(state, ")");
      } else {
        this.test = expression(state, 0);
      }
      this.consequent = block(state);
      if (state.token.id === "else") {
        state.scope.reserve(state.token);
        state = advance(state, "else");
        this.alternate = state.token.id === "if" ? statement(state) : block(state);
      } else {
        this.alternate = null;
      }
      this.type = "IfStatement";
      delete this.value;
      return this;
    });

    //stmt("return", function() {
    //  if (state.token.id !== ";") {
    //    this.first = expression(state, 0);
    //  }
    //  state = advance(state, ";");
    //  if (state.token.id !== "}") {
    //    state.token.error("Unreachable statement.");
    //  }
    //  return this;
    //});

    //stmt("break", function() {
    //  state = advance(state, ";");
    //  if (state.token.id !== "}") {
    //    state.token.error("Unreachable statement.");
    //  }
    //  return this;
    //});

    stmt(state, "while", function() {
      this.type = "WhileStatement";
      if(state.tokens[state.index-1].value === "(") {
        state = advance(state, "(");
        this.test = expression(state, 0);
        state = advance(state, ")");
      } else {
        this.test = expression(state, 0);
      }
      this.body = block(state);
      delete this.value;
      return this;
    });

    stmt(state, "for", function() {
      this.type = "ForStatement";
      if(state.tokens[state.index-1].value === "(") {
        state = advance(state, "(");
        this.init = statements(state, 1);
        this.test = expression(state, 0);
        if(state.token.value === ";") {
          state = advance(state, ";");
        }
        this.update = expression(state, 0);
        state = advance(state, ")");
      } else {
        this.init = statements(state, 1);
        this.test = expression(state, 0);
        if(state.token.value === ";") {
          state = advance(state, ";");
        }
        this.update = expression(state, 0);
      }
      this.body = block(state);
      delete this.value;
      return this;
    });

    stmt(state, "repeat", function() {
      this.type = "DoWhileStatement";
      this.body = block(state);
      if(state.token.value === 'while') {
        state = advance(state);
      }
      if(state.tokens[state.index-1].value === "(") {
        state = advance(state, "(");
        this.test = expression(state, 0);
        state = advance(state, ")");
      } else {
        this.test = expression(state, 0);
      }
      delete this.value;
      return this;
    });

  },
  constants: function(state) {
    //constant(state, "true", true);
    //constant(state, "false", false);
    //constant(state, "null", null);
    //constant(state, "pi", 3.141592653589793);
    //constant(state, "Object", {});
    //constant(state, "Array", []);
  }


}

module.exports = declarations;