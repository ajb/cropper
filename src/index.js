import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import store from './store'
import Cropper from './Cropper';
import * as serviceWorker from './serviceWorker';

import 'colors.css/css/colors.css'
import 'basscss/css/basscss-cp.css'
import 'basscss-forms/index.css'
import 'basscss-btn/css/btn.css'
import 'basscss-btn-primary/css/btn-primary.css'
import 'basscss-btn-outline/css/btn-outline.css'
import './index.css'

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <Cropper />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
