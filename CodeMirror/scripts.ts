// All necessary imports

import { basicSetup, EditorState, EditorView } from "@codemirror/basic-setup";
import { keymap, lineWrapping } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { StateField, EditorSelection } from "@codemirror/state";
import { Tooltip, showTooltip } from "@codemirror/tooltip";
import { indentUnit } from "@codemirror/language";

const axios = require("axios");
const headers = {
  "Access-Control-Allow-Origin": "*",
};

// Initialization

var currentPosition = 0;
var currentRowText = "";
var currentLineFrom = 0;
var currentLineTo = 0;
var arrCUIs = [];
var searchOptions = [];
var lastFetchedCUI = "";
var isCheckingOrder = false;
var suggestions = document.getElementById("suggestions-content");

// Theme Customization

let myTheme = EditorView.theme(
  {
    "cm-editor": {
      fontSize: "24px",
      width: "100%",
      minHeight: "600px",
      outline: 0,
      border: 0,
      fontFamily: "Poppins",
    },
    ".cm-content": {
      fontSize: "24px",
    },
    ".cm-activeLine": {
      backgroundColor: "initial",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-scroller": {
      minHeight: "600px",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      lineHeight: 1.8,
    },
    ".cm-tooltip": {
      fontSize: "24px",
      fontFamily: "Poppins",
    },
    ".cm-lineWrapping": {
      // wordBreak: "break-all",
    },
  },
  { dark: false }
);

// Completion list function
// This function determines when should the autocomplete process begin

function myCompletions(context: CompletionContext) {
  if (
    (currentRowText.length > 0 && currentRowText[0] == " ") ||
    currentRowText.length < 3 ||
    currentRowText.split(" ").length > 2
  ) {
    searchOptions = [];
  }

  let word = context.matchBefore(/\w*/);

  if (word.from == word.to && !context.explicit) return null;
  return {
    from: currentLineFrom,
    to: currentLineTo,
    options: searchOptions,
  };
}

// Follow cursor movement while typing and when changing by mouse click

const cursorTooltipField = StateField.define<readonly Tooltip[]>({
  create: getCursorTooltips,

  update(tooltips, tr) {
    if (!tr.docChanged && !tr.selection) return tooltips;
    return getCursorTooltips(tr.state);
  },

  provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});

function cursorTooltip() {
  return [cursorTooltipField];
}

// Fetch auto completion results from the API

function fetchAutoComplete(startsWith) {
  const body = {
    startsWith: [
      {
        startsWith: startsWith,
      },
    ],
  };

  axios
    .post("https://api.mi1.ai/api/autocompleteProblems", body, { headers })
    .then(function (response) {
      if (response.data.length > 0) {
        searchOptions = [];
      }

      for (var i = 0; i <= response.data.length - 1; i++) {
        let info = response.data[i].Known_CUI;
        let label = response.data[i].Known_Problem;

        searchOptions.push({
          info: info,
          label: label,
          apply: () => {
            arrCUIs.push({
              type: "problem",
              cui: info,
              name: label,
            });
            view.dispatch({
              changes: {
                from: currentLineFrom,
                to: currentLineTo,
                insert: label,
              },
            });
            view.dispatch(
              view.state.update({
                selection: new EditorSelection(
                  [EditorSelection.cursor(currentPosition)],
                  0
                ),
              })
            );
          },
        });
      }
    })
    .catch(function (error) {
      console.log(error);
    })
    .then(function () {});
}

// Fetch problem results from the API

function fetchProblems(CUI) {
  var cuis = [];

  cuis.push({
    CUI: CUI,
  });

  var cuisBody = {
    CUIs: cuis,
  };

  document.getElementById("preloader").style.display = "inline-flex";
  suggestions.innerHTML = "";
  axios
    .post("https://api.mi1.ai/api/PotentialComorbidities", cuisBody, {
      headers,
    })
    .then(function (response) {
      suggestions.innerHTML = "";
      if (response.data.length > 0) {
        suggestions.innerHTML += "<div><h3>Associated Conditions:</h3></div>";
      }
      var suggestion_str = "";
      for (var i = 0; i <= response.data.length - 1; i++) {
        suggestion_str +=
          "<div class='suggestion' data-type='problem' data-cui='" +
          response.data[i].CUI +
          "' data-name='" +
          response.data[i].Problem +
          "'>";
        suggestion_str += "<h5 class='suggestion-text'>";
        suggestion_str += response.data[i].Problem;
        suggestion_str += "</h5>";
        suggestion_str += "</div>";
      }
      suggestions.innerHTML += suggestion_str;
      document.getElementById("preloader").style.display = "none";
    })
    .catch(function (error) {
      document.getElementById("preloader").style.display = "none";
      suggestions.innerHTML = "";
      lastFetchedCUI = "";
      isCheckingOrder = false;
    })
    .then(function () {
      bindProblemsSuggestions();
      highlightSuggestions();
    });
}

// Fetch order results from the API
function fetchOrders(CUI) {
  //var previousLine = state.doc.line(line.number -1).text.toString()
  suggestions.innerHTML = "";

  var bodyUI = {
    CUIs: [
      {
        CUI: CUI,
      },
    ],
  };

  document.getElementById("preloader").style.display = "inline-flex";

  axios
    .post("https://api.mi1.ai/api/AssocOrders", bodyUI, { headers })
    .then(function (response) {
      suggestions.innerHTML = "";
      if (response.data.length > 0) {
        suggestions.innerHTML +=
          "<div><h3>Orders Associated with Problem:</h3></div>";
      }
      var suggestion_str = "";
      for (var i = 0; i <= response.data.length - 1; i++) {
        suggestion_str +=
          "<div class='suggestion' data-type='order' data-problem-cui='" +
          CUI +
          "' data-cui='" +
          response.data[i].Code +
          "' data-name='" +
          response.data[i].Order +
          "'>";
        suggestion_str += "<h5 class='suggestion-text'>";
        suggestion_str += response.data[i].Order;
        suggestion_str += "</h5>";
        suggestion_str +=
          "<span class='tag'>" + response.data[i].Type + "</span>";
        suggestion_str += "</div>";
      }
      suggestions.innerHTML += suggestion_str;
      document.getElementById("preloader").style.display = "none";
    })
    .catch(function (error) {
      document.getElementById("preloader").style.display = "none";
      suggestions.innerHTML = "";
      lastFetchedCUI = "";
      isCheckingOrder = false;
    })
    .then(function () {
      bindOrderSuggestions();
      highlightSuggestions();
    });
}

// The function responsible about the cursor
// Takes state as input and processes information

function getCursorTooltips(state) {
  return state.selection.ranges
    .filter((range) => range.empty)
    .map((range) => {
      let line = state.doc.lineAt(range.head);

      currentLineFrom = line.from;
      currentLineTo = line.to;
      let text = line.number + ":" + (range.head - line.from);
      currentRowText = line.text; // Gets the text of the current row
      currentPosition = range.head; // Gets the head position

      //if( (currentRowText.length >= 3 || currentRowText.length <= 10) && currentRowText[0] != '' && currentRowText[0] != '\t'){
      if (
        currentRowText.length == 3 &&
        currentRowText[0] != "" &&
        currentRowText[0] != "\t"
      ) {
        fetchAutoComplete(currentRowText);
      }

      let index = arrCUIs.findIndex(
        (e) =>
          e.name
            .toString()
            .toLowerCase()
            .replace(/\s/g, "")
            .replace("\t", "") ===
          currentRowText.toLowerCase().replace(/\s/g, "")
      );

      if (index !== -1) {
        if (lastFetchedCUI != arrCUIs[index]["cui"].toString()) {
          if (arrCUIs[index]["type"] == "problem") {
            lastFetchedCUI = arrCUIs[index]["cui"].toString();
            isCheckingOrder = false;
            fetchProblems(lastFetchedCUI);
          } else {
            //if (isCheckingOrder == false){
            lastFetchedCUI = arrCUIs[index]["problemCui"].toString();
            isCheckingOrder = true;
            fetchOrders(lastFetchedCUI);
            //}
          }
        }
      }

      if (line.number == 1 && state.doc.line(line.number).text == "") {
        suggestions.innerHTML = "";
        lastFetchedCUI = "";
        isCheckingOrder = false;
      }

      if (line.number > 1) {
        let previousLine = state.doc.line(line.number - 1).text.toString();
        let previouslineIndex = arrCUIs.findIndex(
          (e) =>
            e.name
              .toString()
              .toLowerCase()
              .replace(/\s/g, "")
              .replace("\t", "") ===
            previousLine.toLowerCase().replace(/\s/g, "")
        );

        if (previouslineIndex !== -1) {
          if (arrCUIs[previouslineIndex]["type"] == "problem") {
            if (isCheckingOrder == false) {
              lastFetchedCUI = arrCUIs[previouslineIndex]["cui"].toString();
              isCheckingOrder = true;
              fetchOrders(lastFetchedCUI);
            }
          }
        }
      }

      highlightSuggestions();
    });
}

// Initialization of the state
// All necessary extensions added to it
// Cursor Movement, Auto Completion, and The use of Tab to indent

const initialState = EditorState.create({
  doc: "",
  extensions: [
    basicSetup,
    keymap.of([indentWithTab]),
    myTheme,
    cursorTooltip(),
    autocompletion({ override: [myCompletions] }),
    EditorView.lineWrapping,
    indentUnit.of("\t"),
  ],
});

// Initialization of the EditorView

const view = new EditorView({
  parent: document.getElementById("editor"),
  state: initialState,
});

// Focuses on the view on page load to let physicians type immediately

window.onload = function () {
  view.focus();
};

// Resets the position back to the view
// When someone clicks the title of the block that contains the editor

document.getElementById("editor-container").onclick = function () {
  view.focus();
};

// This function handles the behavior of clicking an order
// from the sidebar

function bindOrderSuggestions() {
  let all_suggestions = document.getElementsByClassName("suggestion");

  for (var i = 0; i <= all_suggestions.length - 1; i++) {
    var elem = all_suggestions[i];
    elem.onclick = function (e) {
      arrCUIs.push({
        type: this.getAttribute("data-type"),
        cui: this.getAttribute("data-cui"),
        name: this.getAttribute("data-name"),
        problemCui: this.getAttribute("data-problem-cui"),
      });
      var content = "";
      content += "\t";
      content += this.getAttribute("data-name");
      content += "\n";
      view.dispatch({
        changes: { from: currentPosition, insert: content },
      });
      document.getElementById("suggestions-content").innerHTML = "";
      currentPosition += content.length;
      view.focus();
      view.dispatch(
        view.state.update({
          selection: new EditorSelection(
            [EditorSelection.cursor(currentPosition)],
            0
          ),
        })
      );
      highlightSuggestions();
    };
  }
}

// This function handles the behavior of clicking a problem
// from the sidebar

function bindProblemsSuggestions() {
  let all_suggestions = document.getElementsByClassName("suggestion");

  for (var i = 0; i <= all_suggestions.length - 1; i++) {
    var elem = all_suggestions[i];
    elem.onclick = function (e) {
      arrCUIs.push({
        type: this.getAttribute("data-type"),
        cui: this.getAttribute("data-cui"),
        name: this.getAttribute("data-name"),
      });
      var content = "\n\n";
      content += this.getAttribute("data-name");
      var newPosition = view.state.doc.length;
      view.dispatch({
        changes: { from: newPosition, insert: content },
      });
      view.focus();
      highlightSuggestions();
    };
  }
}

// This function checks if the document contains problems or orders
// By comparing them to the list of CUIs we collect and save in memory

function highlightSuggestions() {
  let all_suggestions = document.getElementsByClassName("suggestion");

  for (var i = 0; i <= all_suggestions.length - 1; i++) {
    var elem = all_suggestions[i];
    var index = arrCUIs.findIndex(
      (e) => e.cui === elem.getAttribute("data-cui")
    );
    if (index !== -1) {
      if (arrCUIs[index]["type"] == elem.getAttribute("data-type")) {
        view
          ? view.viewState.state.doc.text.forEach((e) => {
              e.toString().toLowerCase().replace(/\s/g, "").replace("\t", "") ==
              elem.getAttribute("data-name").toLowerCase().replace(/\s/g, "")
                ? elem.classList.add("highlighted")
                : null;
            })
          : null;
      }
    }
  }
}
