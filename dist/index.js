'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.compose = compose;
exports.debounce = debounce;
exports.delay = delay;
exports.createStore = createStore;

exports.default = function () {};

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var tempPropId = 0;
function generateTempProp() {
  return '__prop__' + tempPropId++;
}

function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function (a, b) {
    return function () {
      return a(b.apply(undefined, arguments));
    };
  });
}

function debounce(interval, func) {
  var timerId = void 0;
  return function () {
    clearTimeout(timerId);

    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    timerId = setTimeout.apply(undefined, [func, interval].concat(args));
  };
}

function delay(interval) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, interval);
  });
}

function createStore() {
  var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var subscribers = [];
  var reducerMap = {};
  var reducers = [];
  var actionQueue = [];
  var patches = [];
  var promises = {};
  var currentState = initialState;

  var applyPatches = debounce(0, function applyPatches() {
    var nextState = currentState;
    patches.forEach(function (_ref) {
      var prop = _ref.prop,
          payload = _ref.payload;

      if (nextState[prop] !== payload) {
        nextState = Object.assign({}, nextState, _defineProperty({}, prop, payload));
      }
    });

    if (nextState !== currentState) {
      currentState = nextState;
      notifyChange();
    }
  });

  function notifyChange() {
    subscribers.slice().forEach(function (subscriber) {
      return subscriber(currentState);
    });
  }

  function patchState(prop, promise) {
    promises[prop] = promise;
    promise.then(function (payload) {
      // dont apply patch if this promise is not latest
      if (promises[prop] !== promise) return;
      patches.push({ prop: prop, payload: payload });
      applyPatches();
    });
  }

  var callReducer = debounce(0, function callReducer() {
    var nextState = currentState;
    var copyQueue = actionQueue.slice();
    var customActions = [];
    actionQueue.length = 0;
    copyQueue.forEach(function (actionData) {
      function next(actionData) {
        var action = actionData.action,
            payload = actionData.payload;


        if (action instanceof Function) {
          customActions.push({ action: action, payload: payload });
          return;
        }

        reducers.forEach(function (_ref2) {
          var _ref3 = _slicedToArray(_ref2, 2),
              prop = _ref3[0],
              reducer = _ref3[1];

          var currentValue = nextState[prop];
          var reducerContext = {
            action: action,
            payload: payload,
            dispatch: function dispatch() {
              _dispatch.apply(undefined, arguments);
              return currentValue;
            }
          };
          var nextValue = reducer(currentValue, reducerContext);
          if (nextValue !== currentValue) {
            if (nextValue && nextValue.then) {
              patchState(prop, nextValue);
            } else {
              nextState = Object.assign({}, nextState, _defineProperty({}, prop, nextValue));
            }
          }
        });
      }
      next(actionData);
    });

    if (nextState !== currentState) {
      currentState = nextState;
      notifyChange();
    }

    customActions.forEach(function (_ref4) {
      var action = _ref4.action,
          payload = _ref4.payload;

      action(currentState, payload, _dispatch);
    });
  });

  function subscribe(subscriber) {
    subscribers.push(subscriber);
    return function () {
      var index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  function composeReducer(prop, reducer) {
    if (prop in reducerMap) {
      var prev = reducerMap[prop];
      reducerMap[prop] = function () {
        for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        var state = prev.apply(undefined, args);
        return reducer(state, args.slice(1));
      };
    } else {
      reducerMap[prop] = reducer;
    }
  }

  function reducer() {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    if (args[0] === null || args[0] === undefined) {
      args[0] = generateTempProp();
    }
    if (typeof args[0] === 'string') {
      // reducer(prop, reducer:any)
      // reducer(prop, action, reducer)

      var prop = args[0];
      if (typeof args[1] === 'string') {
        // reducer(prop, action, reducer)
        var actions = args[1].split(/\s+/);
        var actionReducer = args[2];
        composeReducer(prop, function (state, context) {
          if (actions.indexOf(context.action) !== -1) {
            return actionReducer(context, state);
          }
          return state;
        });
      } else {
        // reducer(prop, reducer:Function)
        // reducer(prop, reducer:Object)
        if (args[1] instanceof Function) {
          // reducer(prop, reducer:Function)
          var _reducer = args[1];
          composeReducer(prop, _reducer instanceof Function ? _reducer : function () {
            return _reducer;
          });
        } else {
          // reducer(prop, reducer:Object)
          // bind multiple action reducers
          var actionReducers = args[1];
          composeReducer(prop, function (state, context) {
            var actionReducer = actionReducers[context.action];
            if (actionReducer) {
              return actionReducer instanceof Function ? actionReducers[context.action](context, state) : actionReducer;
            }
            return state;
          });
        }
      }
    } else {
      var newReducers = args[0];
      Object.entries(newReducers).forEach(function (_ref5) {
        var _ref6 = _slicedToArray(_ref5, 2),
            prop = _ref6[0],
            reducer = _ref6[1];

        composeReducer(prop, reducer);
      });
    }
    reducers.length = 0;
    reducers.push.apply(reducers, _toConsumableArray(Object.entries(reducerMap)));
  }

  function getState() {
    return currentState;
  }

  function _dispatch(action, payload, types) {
    if (payload && payload.then) {
      if (types) {
        if (action !== undefined && action !== null) {
          _dispatch(action);
        }

        payload.then(function (result) {
          return _dispatch(types.success, result);
        }, function (result) {
          return _dispatch(types.failure, result);
        });
      } else {
        payload.then(function (result) {
          return _dispatch(action, result);
        });
      }

      return;
    }

    actionQueue.push({ action: action, payload: payload });
    callReducer();
  }

  return {
    dispatch: _dispatch,
    getState: getState,
    reducer: reducer,
    subscribe: subscribe
  };
}
//# sourceMappingURL=index.js.map