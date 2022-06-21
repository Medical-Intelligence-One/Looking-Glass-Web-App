// All necessary imports

import { basicSetup, EditorState, EditorView } from '@codemirror/basic-setup';
import { keymap, lineWrapping } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { autocompletion, CompletionContext } from "@codemirror/autocomplete"
import { StateField, EditorSelection } from "@codemirror/state"
import { Tooltip, showTooltip } from "@codemirror/tooltip"
import { indentUnit } from '@codemirror/language'

const axios = require('axios')
const headers = {
    'Access-Control-Allow-Origin': '*'
}

// Initialization

var isLineChanged = false;
var isLineChangeNum = 1;
var check_order_for_order = false
let parent_problem
let current_state: EditorState
let current_line = 1
var currentPosition = 0
var currentRowText = ''
var currentLineFrom = 0
var currentLineTo = 0
var arrCUIs = []
var searchOptions = []
var lastFetchedCUI = ''
var isCheckingOrder = false
var suggestions = document.getElementById('suggestions-content')
var lastAjaxCall = {
    endpoint: '',
    cui: ''
};


// Theme Customization

// let myTheme = EditorView.theme({
//   "cm-editor": {
//     fontSize: "24px",
//     width: "100%",
//     minHeight: "600px",
//     outline: 0,
//     border: 0,
//     fontFamily: 'Poppins'
//   },
//   ".cm-content": {
//   	fontSize: "24px"
//   },
//   ".cm-activeLine": {
//   	backgroundColor: "initial"
//   },
//   ".cm-gutters": {
//     display: "none"
//   },
//   ".cm-scroller": {
//     minHeight: "600px"
//   },
//   ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
//   	lineHeight: 1.8
//   },
//   ".cm-tooltip": {
//   	fontSize: "24px",
//   	fontFamily: 'Poppins'
//   },
//   ".cm-lineWrapping": {
//       // wordBreak: "break-all",
//   }
// }, {dark: false})


let myTheme = EditorView.theme({
    ".cm-editor": {
        fontSize: "18px",
        width: "100%",
        outline: 0,
        border: 0,
        fontFamily: 'Rubik Light, Open Sans'
    },
    ".cm-content": {
        fontSize: "18px"
    },
    ".cm-activeLine": {
        backgroundColor: "initial"
    },
    ".cm-gutters": {
        display: "none"
    },
    ".cm-scroller": {
        fontFamily: 'Rubik Light, Open Sans'
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        lineHeight: 1.8,
        fontFamily: "Rubik Light, Open Sans",
        textAlign: "left"

    },
    ".cm-tooltip": {
        fontSize: "14px",
        fontFamily: 'Rubik Light, Open Sans'
    }
}, { dark: false })

// Completion list function
// This function determines when should the autocomplete process begin

function myCompletions(context: CompletionContext) {

    if ((currentRowText.length > 0 && currentRowText[0] == ' ') || (currentRowText.length < 3)) {
        searchOptions = []
    }

    let word = context.matchBefore(/\w*/)

    if (word.from == word.to && !context.explicit)
        return null
    if (currentRowText.startsWith('\t')) {
        return {
            from: currentLineFrom + 1,
            to: currentLineTo,
            options: searchOptions
        }
    }
    return {
        from: currentLineFrom,
        to: currentLineTo,
        options: searchOptions
    }

}

// Follow cursor movement while typing and when changing by mouse click

const cursorTooltipField = StateField.define<readonly Tooltip[]>({
    create: getCursorTooltips,

    update(tooltips, tr) {
        if (!tr.docChanged && !tr.selection) return tooltips
        return getCursorTooltips(tr.state)
    },

    provide: f => showTooltip.computeN([f], state => state.field(f))
})

function cursorTooltip() {
    return [cursorTooltipField]
}

// Fetch auto completion results from the API

async function fetchAutoComplete(startsWith) {

    const body = {
        "startsWith":
            [
                {
                    "startsWith": startsWith
                }
            ]
    }

    await axios.post('https://api.mi1.ai/api/autocompleteProblems', body, { headers })
        .then(function (response) {

            if (response.data.length > 0) {
                searchOptions = []
            }

            for (var i = 0; i <= response.data.length - 1; i++) {

                let info = response.data[i].Known_CUI
                let label = response.data[i].Known_Problem

                searchOptions.push({
                    info: info,
                    label: label,
                    apply: () => {
                        arrCUIs.push({
                            type: 'problem',
                            cui: info,
                            name: label
                        })
                        view.dispatch({
                            changes: { from: currentLineFrom, to: currentLineTo, insert: label }
                        })
                        view.dispatch(
                            view.state.update({
                                selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
                            })
                        )
                    }
                })

            }

        }).catch(function (error) { console.log(error) }).then(function () { })

}

// autocompleteOrders api
async function fetchAutoCompleteOrders(startsWith) {

    const body = {
        "startsWith":
            [
                {
                    "startsWith": startsWith
                }
            ]
    }

    await axios.post('https://api.mi1.ai/api/autocompleteOrders', body, { headers })
        .then(function (response) {
            if (response.data.length > 0) {
                searchOptions = []
            }
            searchOptions = []
            for (var i = 0; i <= response.data.length - 1; i++) {

                let info = response.data[i].Known_CUI
                let label = response.data[i].Known_Order

                searchOptions.push({
                    info: info,
                    label: label,
                    apply: () => {
                        arrCUIs.push({
                            type: 'order',
                            ordercui: info,
                            name: label
                        })
                        view.dispatch({
                            changes: { from: currentLineFrom, to: currentLineTo, insert: "\t" + label }
                        })
                        let contentLength = currentLineFrom + label.length + 1
                        view.dispatch(
                            view.state.update({
                                selection: new EditorSelection([EditorSelection.cursor(contentLength)], 0)
                            })
                        )
                    }
                })

            }

        }).catch(function (error) { console.log(error) }).then(function () { })

}

// Fetch problem results from the API

async function fetchProblems(CUI) {

    var cuis = []

    cuis.push({
        CUI: CUI
    })

    var cuisBody = {
        "CUIs": cuis
    }

    lastAjaxCall.endpoint = 'PotentialComorbidities'
    lastAjaxCall.cui = CUI

    //   document.getElementById('preloader').style.display = 'inline-flex'
    //   document.getElementById('particles-js').style.display = 'none'
    suggestions.innerHTML = ''
    await axios.post('https://api.mi1.ai/api/PotentialComorbidities', cuisBody, { headers })
        .then(function (response) {
            if (response.data.length === 0) {
                // suggestions.innerHTML = '<div><h3>No Data for problems:</h3></div>'	
                document.getElementById("defaultOpen").click();
                document.getElementById("problem_tab").style.display = 'block';
                document.getElementById("suggestions-content").style.display = 'none';
                document.getElementById("orders_tab").style.display = 'none';
                document.getElementById('preloader').style.display = 'none'
                // document.getElementById('particles-js').style.display = 'block'
            }
            else {
                suggestions.innerHTML = ''
                if (response.data.length > 0) {
                    // document.getElementById('particles-js').style.display = 'none'
                    document.getElementById("suggestions-content").style.display = 'block';
                    document.getElementById("defaultOpen").click();
                    document.getElementById("problem_tab").style.display = 'block';
                    document.getElementById("orders_tab").style.display = 'none';
                    suggestions.innerHTML += '<div><h4>Associated Conditions</h4></div>'
                }
                var suggestion_str = ''
                for (var i = 0; i <= response.data.length - 1; i++) {
                    suggestion_str += "<div class='row suggestion' data-type='problem' data-cui='" + response.data[i].CUI + "' data-name='" + response.data[i].Problem + "'>"
                    suggestion_str += "<h5 class='col-12 suggestion-text'>"
                    suggestion_str += response.data[i].Problem
                    suggestion_str += "</h5>"
                    // suggestion_str += "<span class='col-2'></span>"
                    suggestion_str += "</div>"
                }
                suggestions.innerHTML += suggestion_str
                document.getElementById('preloader').style.display = 'none'
            }

        }).catch(function (error) {

            document.getElementById('preloader').style.display = 'none'
            suggestions.innerHTML = ''
            lastFetchedCUI = ''
            isCheckingOrder = false

        }).then(function () {

            bindProblemsSuggestions()
            highlightSuggestions()

        })

}

// Fetch order results from the API
async function fetchOrders(CUI) {

    suggestions.innerHTML = ''

    var bodyUI = {
        "CUIs":
            [
                {
                    "CUI": CUI
                }
            ]
    }

    lastAjaxCall.endpoint = 'AssocOrders'
    lastAjaxCall.cui = CUI

    document.getElementById('preloader').style.display = 'inline-flex'
    // document.getElementById('particles-js').style.display = 'none'					
    await axios.post('https://api.mi1.ai/api/AssocOrders', bodyUI, { headers })
        .then(function (response) {

            if (response.data.length == 0) {
                // document.getElementById('particles-js').style.display = 'block'
                // suggestions.innerHTML = '<div><h3>No Data for orders:</h3></div>'
                document.getElementById("suggestions-content").style.display = 'none';
                document.getElementById("problem_tab").style.display = 'none';
                document.getElementById("orders_tab").style.display = 'block';
                document.getElementById("defaultOpenForOrders").click();
                document.getElementById('preloader').style.display = 'none'
            }
            else {
                suggestions.innerHTML = ''
                if (response.data.length > 0) {
                    if (check_order_for_order == true) { suggestions.innerHTML += '<div><h4>Orders Associated with Orders</h4></div>' }
                    else { suggestions.innerHTML += '<div><h4>Orders Associated with Problems</h4></div>' }
                    document.getElementById("problem_tab").style.display = 'none';
                    document.getElementById("orders_tab").style.display = 'block';
                    document.getElementById("suggestions-content").style.display = 'block';
                    document.getElementById("defaultOpenForOrders").click();
                    // document.getElementById('particles-js').style.display = 'none'
                }
                var suggestion_str = ''
                for (var i = 0; i <= response.data.length - 1; i++) {
                    suggestion_str += "<div class='row suggestion' data-type='order' data-problem-cui='" + CUI + "' data-cui='" + response.data[i].Code + "' data-name='" + response.data[i].Order + "' parent-problem='" + parent_problem + "' >"
                    suggestion_str += "<span class='col-2'></span><h5 class='col-8 suggestion-text'>"
                    suggestion_str += response.data[i].Order
                    suggestion_str += "</h5>"
                    suggestion_str += "<span class='tag col-2'>" + response.data[i].Type + "</span>"
                    suggestion_str += "</div>"
                }
                suggestions.innerHTML += suggestion_str
                document.getElementById('preloader').style.display = 'none'
            }

        }).catch(function (error) {

            document.getElementById('preloader').style.display = 'none'
            suggestions.innerHTML = ''
            lastFetchedCUI = ''
            isCheckingOrder = false

        }).then(function () {

            bindOrderSuggestions()
            highlightSuggestions()

        })

}

// The function responsible about the cursor
// Takes state as input and processes information

function getCursorTooltips(state: EditorState) {

    return state.selection.ranges
        .filter(range => range.empty)
        .map(range => {

            let line = state.doc.lineAt(range.head)
            currentLineFrom = line.from
            currentLineTo = line.to
            current_line = line.number
            current_state = state
            let text = line.number + ":" + (range.head - line.from)
            currentRowText = line.text // Gets the text of the current row
            currentPosition = range.head // Gets the head position

            // Check for line changes
            if (isLineChangeNum == currentLineFrom) {
                isLineChanged = false
            } else {
                isLineChanged = true
                isLineChangeNum = currentLineFrom
            }


            if ((currentRowText.length == 3) && currentRowText[0] != '' && currentRowText[0] != '\t') {
                fetchAutoComplete(currentRowText)
            }
            if (currentRowText.length == 4 && currentRowText[0] == '\t') {
                fetchAutoCompleteOrders(currentRowText.trimStart())
            }

            let index = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === currentRowText.toLowerCase().replace(/\s/g, ''))
            // console.log(currentRowText, index)	
            if (index !== -1) {



                if (arrCUIs[index]['type'] == 'problem') {
                    lastFetchedCUI = arrCUIs[index]['cui'].toString()
                    isCheckingOrder = false

                    if (!(lastAjaxCall.cui == lastFetchedCUI && lastAjaxCall.endpoint == 'PotentialComorbidities')) { fetchProblems(lastFetchedCUI) }
                } else {

                    check_order_for_order = true
                    lastFetchedCUI = arrCUIs[index]['ordercui'].toString()
                    isCheckingOrder = true
                    if (!(lastAjaxCall.cui == lastFetchedCUI && lastAjaxCall.endpoint == 'AssocOrders')) { fetchOrders(lastFetchedCUI) }
                }

            }
            if (line.number > 1) {
                let temp_line = line.number
                let previousLine = ""
                for (; temp_line > 1;) {
                    temp_line--
                    if (state.doc.line(temp_line).text.length == state.doc.line(temp_line).text.trimStart().length) {
                        previousLine = state.doc.line(temp_line).text
                        parent_problem = previousLine
                        break
                    }
                }
                let index1 = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === currentRowText.toLowerCase().replace(/\s/g, ''))

                if (index1 !== -1) {
                    if (isCheckingOrder == false) {
                        if (arrCUIs[index1]['type'] == 'order') {
                            isCheckingOrder = true
                            check_order_for_order = true
                            lastFetchedCUI = arrCUIs[index1]['ordercui'].toString()

                            fetchOrders(lastFetchedCUI)
                        }
                    }
                }
                let previouslineIndex = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === previousLine.toLowerCase().replace(/\s/g, ''))

                if (previouslineIndex !== -1 && index1 === -1 && isLineChanged == true) {
                    if (arrCUIs[previouslineIndex]['type'] == 'problem') {

                        check_order_for_order = false
                        lastFetchedCUI = arrCUIs[previouslineIndex]['cui'].toString()
                        isCheckingOrder = true
                        fetchOrders(lastFetchedCUI)

                    }
                }
            }

            if (line.number == 1 && state.doc.line(line.number).text == '') {
                suggestions.innerHTML = ''
                // document.getElementById("problem_tab").style.display = "none"
                // document.getElementById("particles-js").style.display = "block"
                lastFetchedCUI = ''
                isCheckingOrder = false
            }


            highlightSuggestions()

        })

}


// Initialization of the state
// All necessary extensions added to it
// Cursor Movement, Auto Completion, and The use of Tab to indent

const initialState = EditorState.create({
    doc: '',
    extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        myTheme,
        cursorTooltip(),
        autocompletion({ override: [myCompletions] }),
        EditorView.lineWrapping,
        indentUnit.of("\t")
    ],
})

// Initialization of the EditorView

const view = new EditorView({
    parent: document.getElementById('editor'),
    state: initialState,
})

// Focuses on the view on page load to let physicians type immediately

window.onload = function () {
    view.focus()
    particlesJS.load('particles-js', 'particlesjs.json', function (e) { console.log('particles loaded') })
}

// Resets the position back to the view
// When someone clicks the title of the block that contains the editor

document.getElementById('editor-container').onclick = function () {
    view.focus()
}

// This function handles the behavior of clicking an order
// from the sidebar

function bindOrderSuggestions() {

    let all_suggestions = document.getElementsByClassName('suggestion')
    let index1 = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === currentRowText.toLowerCase().replace(/\s/g, ''))
    for (var i = 0; i <= all_suggestions.length - 1; i++) {

        var elem = all_suggestions[i]
        elem.onclick = function (e) {
            arrCUIs.push({
                type: this.getAttribute('data-type'),
                ordercui: this.getAttribute('data-cui'),
                name: this.getAttribute('data-name'),
                problemCui: this.getAttribute('data-problem-cui')
            })
            var content = ''
            if (currentRowText.length == 0 || currentRowText.trim().length == 0) {
                content += '\t'
                content += this.getAttribute('data-name')
                content += '\n'
                view.dispatch({
                    changes: { from: currentLineFrom, to: currentLineTo, insert: content }
                })
                currentPosition = currentLineFrom + content.length
                view.focus()
                view.dispatch(
                    view.state.update({
                        selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
                    })
                )
            }
            else if (currentRowText.startsWith('\t') && index1 === -1) {
                content += '\t'
                content += this.getAttribute('data-name')
                view.dispatch({
                    changes: { from: currentLineFrom, to: currentLineTo, insert: content }
                })
                currentPosition = currentLineFrom + content.length
                view.focus()
                view.dispatch(
                    view.state.update({
                        selection: new EditorSelection([EditorSelection.cursor(currentPosition)], 0)
                    })
                )
            } else {
                let get_line_before_problem: number
                let totalline = current_state.doc.lines;

                for (var i = current_line; i <= totalline; i++) {
                    let get_line = current_state.doc.line(i);
                    if (!get_line.text.startsWith('\t')) {
                        break
                    }
                    get_line_before_problem = i
                }
                let final_line = current_state.doc.line(get_line_before_problem);
                content += '\n'
                content += '\t'
                content += this.getAttribute('data-name')
                view.dispatch({
                    changes: { from: final_line.to, insert: content }
                })
            }
            document.getElementById('suggestions-content').innerHTML = ''

            view.focus()

            highlightSuggestions()
        }

    }

}

// This function handles the behavior of clicking a problem
// from the sidebar

function bindProblemsSuggestions() {

    let all_suggestions = document.getElementsByClassName('suggestion')

    for (var i = 0; i <= all_suggestions.length - 1; i++) {

        var elem = all_suggestions[i]
        elem.onclick = function (e) {
            arrCUIs.push({
                type: this.getAttribute('data-type'),
                cui: this.getAttribute('data-cui'),
                name: this.getAttribute('data-name')
            })
            var content = '\n\n'
            content += this.getAttribute('data-name')
            var newPosition = view.state.doc.length
            view.dispatch({
                changes: { from: newPosition, insert: content }
            })
            view.focus()
            highlightSuggestions()
        }

    }

}

// This function checks if the document contains problems or orders
// By comparing them to the list of CUIs we collect and save in memory

function highlightSuggestions() {

    let all_suggestions = document.getElementsByClassName('suggestion')

    for (var i = 0; i <= all_suggestions.length - 1; i++) {

        var elem = all_suggestions[i]
        var index = arrCUIs.findIndex(e => e.cui === elem.getAttribute('data-cui'))
        if (index !== -1) {
            if (arrCUIs[index]['type'] == elem.getAttribute('data-type')) {

                view ? view.viewState.state.doc.text.forEach((e) {
                    (e.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g, '')) ? elem.classList.add('highlighted') : null
                }) : null

            }
        }
        var index1 = arrCUIs.findIndex(e => e.ordercui === elem.getAttribute('data-cui'))
        if (index1 !== -1) {
            if (arrCUIs[index1]['type'] == elem.getAttribute('data-type')) {

                view ? view.viewState.state.doc.text.forEach((e) {
                    (e.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g, '')) ? elem.classList.add('highlighted') : null
                }) : null

            }
        }

    }

}