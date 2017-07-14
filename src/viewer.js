/* Copyright (c) 2017, Art Compiler LLC */
/* @flow */
import {assert, message, messages, reserveCodeRange} from "./assert";
import * as React from "react";
import * as d3 from "d3";
window.gcexports.viewer = (function () {
  function capture(el) {
    return null;
  }
  let Viewer = React.createClass({
    componentDidMount: function() {
    },
    componentDidUpdate: function() {
    },
    render: function () {
      return (
        <div id="chart" className="chart-container">
        </div>
      );
    },
  });
  return {
    capture: capture,
    Viewer: Viewer
  };
})();
