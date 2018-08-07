# Fluxor
A state management based on flux architecture

```js
import { createStore, delay } from './fluxor';

const store = createStore({
  todos: [],
  text: ''
});

const actions = {
  addTodo: 'add-todo',
  removeTodo: 'remove-todo',
  todosLoaded: 'todos-loaded',
  todosLoading: 'todos-loading',
  todosFailed: 'todos-failed',
  ensureTodosLoaded: 'ensute-todos-loaded',
  textChanged: 'text-changed'
};

let uniqueId = 0;
const todosReducer = (state = [], { action, payload }) => {
  switch (action) {
    case actions.addTodo:
      return [...state, { id: uniqueId++, text: payload }];
    case actions.removeTodo:
      const todoIndex = state.findIndex(todo => todo.id === payload);
      if (todoIndex !== -1) {
        return [...state.slice(0, todoIndex), ...state.slice(todoIndex + 1)];
      }
      break;
    case actions.todosLoaded:
      return [...state, ...payload];
  }

  return state;
};
const loadTodos = async () => {
  // simulate long pending task
  await delay(3000);
  const res = await fetch('./todos.json');
  return await res.json();
};
// handle state changed
store.subscribe(state => {
  const pre = document.createElement('pre');
  const root = document.getElementById('root');
  pre.innerHTML = JSON.stringify(state, null, 2);
  root.appendChild(pre);
  root.appendChild(document.createElement('hr'));
});
// register multiple reducers at once
store.reducer({
  todos: todosReducer
});
// register reducer with multiple action processors
// passing null as state prop means, this is temporary prop and no name needed
store.reducer(null, {
  [actions.ensureTodosLoaded]: ({ dispatch }, state) => {
    if (!state) {
      // dispatch actions for async task
      dispatch(null, loadTodos(), {
        success: actions.todosLoaded,
        failure: actions.todosFailed
      });
      return 'loading';
    }
    return state;
  },
  [actions.todosFailed]: 'failed',
  [actions.todosLoaded]: 'loaded'
});
// register reducer with single action processor
store.reducer('text', actions.textChanged, ({ payload }) => payload);

store.dispatch(actions.addTodo, 'Task 1');
store.dispatch(actions.addTodo, 'Task 2');
store.dispatch(actions.addTodo, 'Task 3');
store.dispatch(actions.removeTodo, 1);
store.dispatch(actions.ensureTodosLoaded);
store.dispatch(actions.ensureTodosLoaded);

```