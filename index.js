let tempPropId = 0;
function generateTempProp() {
  return `__prop__${tempPropId++}`;
}

export function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

export function debounce(interval, func) {
  let timerId;
  return function(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(func, interval, ...args);
  };
}

export function delay(interval) {
  return new Promise(resolve => setTimeout(resolve, interval));
}

export function createStore(initialState = {}) {
  const subscribers = [];
  const reducerMap = {};
  const reducers = [];
  const actionQueue = [];
  const patches = [];
  const promises = {};
  let currentState = initialState;

  const applyPatches = debounce(0, function applyPatches() {
    let nextState = currentState;
    patches.forEach(({ prop, payload }) => {
      if (nextState[prop] !== payload) {
        nextState = Object.assign({}, nextState, {
          [prop]: payload
        });
      }
    });

    if (nextState !== currentState) {
      currentState = nextState;
      notifyChange();
    }
  });

  function notifyChange() {
    subscribers.slice().forEach(subscriber => subscriber(currentState));
  }

  function patchState(prop, promise) {
    promises[prop] = promise;
    promise.then(payload => {
      // dont apply patch if this promise is not latest
      if (promises[prop] !== promise) return;
      patches.push({ prop, payload });
      applyPatches();
    });
  }

  const callReducer = debounce(0, function callReducer() {
    let nextState = currentState;
    const copyQueue = actionQueue.slice();
    const customActions = [];
    actionQueue.length = 0;
    copyQueue.forEach(actionData => {
      function next(actionData) {
        const { action, payload } = actionData;

        if (action instanceof Function) {
          customActions.push({ action, payload });
          return;
        }

        reducers.forEach(([prop, reducer]) => {
          const currentValue = nextState[prop];
          const reducerContext = {
            action,
            payload,
            dispatch(...args) {
              dispatch(...args);
              return currentValue;
            }
          };
          const nextValue = reducer(currentValue, reducerContext);
          if (nextValue !== currentValue) {
            if (nextValue && nextValue.then) {
              patchState(prop, nextValue);
            } else {
              nextState = Object.assign({}, nextState, {
                [prop]: nextValue
              });
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

    customActions.forEach(({ action, payload }) => {
      action(currentState, payload, dispatch);
    });
  });

  function subscribe(subscriber) {
    subscribers.push(subscriber);
    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  function composeReducer(prop, reducer) {
    if (prop in reducerMap) {
      const prev = reducerMap[prop];
      reducerMap[prop] = function(...args) {
        const state = prev(...args);
        return reducer(state, args.slice(1));
      };
    } else {
      reducerMap[prop] = reducer;
    }
  }

  function reducer(...args) {
    if (args[0] === null || args[0] === undefined) {
      args[0] = generateTempProp();
    }
    if (typeof args[0] === 'string') {
      // reducer(prop, reducer:any)
      // reducer(prop, action, reducer)

      const prop = args[0];
      if (typeof args[1] === 'string') {
        // reducer(prop, action, reducer)
        const actions = args[1].split(/\s+/);
        const actionReducer = args[2];
        composeReducer(prop, (state, context) => {
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
          const reducer = args[1];
          composeReducer(
            prop,
            reducer instanceof Function ? reducer : () => reducer
          );
        } else {
          // reducer(prop, reducer:Object)
          // bind multiple action reducers
          const actionReducers = args[1];
          composeReducer(prop, (state, context) => {
            const actionReducer = actionReducers[context.action];
            if (actionReducer) {
              return actionReducer instanceof Function
                ? actionReducers[context.action](context, state)
                : actionReducer;
            }
            return state;
          });
        }
      }
    } else {
      const newReducers = args[0];
      Object.entries(newReducers).forEach(([prop, reducer]) => {
        composeReducer(prop, reducer);
      });
    }
    reducers.length = 0;
    reducers.push(...Object.entries(reducerMap));
  }

  function getState() {
    return currentState;
  }

  function dispatch(action, payload, types) {
    if (payload && payload.then) {
      if (types) {
        if (action !== undefined && action !== null) {
          dispatch(action);
        }

        payload.then(
          result => dispatch(types.success, result),
          result => dispatch(types.failure, result)
        );
      } else {
        payload.then(result => dispatch(action, result));
      }

      return;
    }

    actionQueue.push({ action, payload });
    callReducer();
  }

  return {
    dispatch,
    getState,
    reducer,
    subscribe
  };
}

export default function() {}
