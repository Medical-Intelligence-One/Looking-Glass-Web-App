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
var view

// Theme Customization

let myTheme = EditorView.theme({
	"cm-editor": {
		fontSize: "18px",
		width: "100%",
		minHeight: "600px",
		outline: 0,
		border: 0,
		fontFamily: 'Verdana'
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
		minHeight: "600px",
		fontFamily: "Verdana"
	},
	".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
		lineHeight: 1.8,
		fontFamily: "Verdana",

	},
	".cm-tooltip": {
		fontSize: "18px",
		fontFamily: 'Verdana'
	},
	".cm-lineWrapping": {
		// wordBreak: "break-all",
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

async function fetchData(CUI, parentCategory) {

	var cuis = []
	var childCategory, textField, typeField, descriptionField, scoreField;
	cuis.push({
		CUI: CUI
	})

	var cuisBody = {
		"CUIs": cuis
	}

	$('.suggestions-container').remove();
	await axios.post('https://api.mi1.ai/api/PotentialComorbidities', cuisBody, { headers })
		.then(async function (response) {
			childCategory = 'Problem';
			textField = 'Problem';
			typeField = '';
			descriptionField = '';
			scoreField = 'Score';

			showOrderData(response, parentCategory, childCategory, textField, typeField, descriptionField, scoreField);
		});
	// if (response.data.length === 0) {
	await axios.post('https://api.mi1.ai/api/AssocOrders', cuisBody, { headers })
		.then(function (response) {
			if (response.data.length != 0) {
				childCategory = 'Order';
				textField = 'Order';
				typeField = 'Type';
				descriptionField = '';
				scoreField = 'Score';
				showOrderData(response, parentCategory, childCategory, textField, typeField, descriptionField, scoreField);		// if (response.data.length === 0) {
			}
		}).then(function () {

			// bindProblemsSuggestions()
			// highlightSuggestions()

		}).catch(function (error) {

			document.getElementById('preloader').style.display = 'none'
			suggestions.innerHTML = ''
			lastFetchedCUI = ''
			isCheckingOrder = false
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
			var parentCategory

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
					parentCategory = 'Problem'
				} else {						//cursor is on an order
					parentCategory = 'Order'
					check_order_for_order = true
					lastFetchedCUI = arrCUIs[index]['ordercui'].toString()
					isCheckingOrder = true
				}
				fetchData(lastFetchedCUI, parentCategory)

			}
			// if (line.number > 1) {
			// 	let temp_line = line.number
			// 	let previousLine = ""
			// 	for (; temp_line > 1;) {
			// 		temp_line--
			// 		if (state.doc.line(temp_line).text.length == state.doc.line(temp_line).text.trimStart().length) {
			// 			previousLine = state.doc.line(temp_line).text
			// 			parent_problem = previousLine
			// 			break
			// 		}
			// 	}
			// 	let index1 = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === currentRowText.toLowerCase().replace(/\s/g, ''))

			// 	if (index1 !== -1) {
			// 		if (isCheckingOrder == false) {
			// 			if (arrCUIs[index1]['type'] == 'order') {
			// 				isCheckingOrder = true
			// 				check_order_for_order = true
			// 				lastFetchedCUI = arrCUIs[index1]['ordercui'].toString()

			// 				fetchOrders(lastFetchedCUI)
			// 			}
			// 		}
			// 	}
			// 	let previouslineIndex = arrCUIs.findIndex(e => e.name.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') === previousLine.toLowerCase().replace(/\s/g, ''))

			// 	if (previouslineIndex !== -1 && index1 === -1 && isLineChanged == true) {
			// 		if (arrCUIs[previouslineIndex]['type'] == 'problem') {

			// 			check_order_for_order = false
			// 			lastFetchedCUI = arrCUIs[previouslineIndex]['cui'].toString()
			// 			isCheckingOrder = true
			// 			fetchOrders(lastFetchedCUI)

			// 		}
			// 	}
			// }

			// if (line.number == 1 && state.doc.line(line.number).text == '') {
			// suggestions.innerHTML = ''
			// document.getElementById("problem_tab").style.display = "none"
			// document.getElementById("particles-js").style.display = "block"
			// 	lastFetchedCUI = ''
			// 	isCheckingOrder = false
			// }


			highlightSuggestions()

		})

}


// Initialization of the state
// All necessary extensions added to it
// Cursor Movement, Auto Completion, and The use of Tab to indent


jQuery(function () {
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

	view = new EditorView({
		parent: document.getElementById('editor'),
		state: initialState,
	})

	let element: HTMLElement = $('#editor-container')[0] as HTMLElement;


	// Resets the position back to the view
	// When someone clicks the title of the block that contains the editor
	element.addEventListener('click', function () {
		view.focus()
	})
	// Focuses on the view on page load to let physicians type immediately
	view.focus();
})

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
			// document.getElementById('suggestions-content').innerHTML = ''

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

	// for (var i = 0; i <= all_suggestions.length - 1; i++) {

	// 	var elem = all_suggestions[i]
	// 	var index = arrCUIs.findIndex(e => e.cui === elem.getAttribute('data-cui'))
	// 	if (index !== -1) {
	// 		if (arrCUIs[index]['type'] == elem.getAttribute('data-type')) {

	// 			view ? view.viewState.state.doc.text.forEach((e) {
	// 				(e.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g, '')) ? elem.classList.add('highlighted') : null
	// 			}) : null

	// 		}
	// 	}
	// 	var index1 = arrCUIs.findIndex(e => e.ordercui === elem.getAttribute('data-cui'))
	// 	if (index1 !== -1) {
	// 		if (arrCUIs[index1]['type'] == elem.getAttribute('data-type')) {

	// 			view ? view.viewState.state.doc.text.forEach((e) {
	// 				(e.toString().toLowerCase().replace(/\s/g, '').replace('\t', '') == elem.getAttribute('data-name').toLowerCase().replace(/\s/g, '')) ? elem.classList.add('highlighted') : null
	// 			}) : null

	// 		}
	// 	}

}

//display output from api call
function showOrderData(response, parentCategory, childCategory, textField = '', typeField = '', descriptionField = '', scoreField = '') {

	var $divOrder;
	var $divSuggestion;
	var i;
	var title = parentCategory + ': ' + currentRowText;
	$('#suggestions-title-text').text(title);

	//populate parent div
	var containerID = 'div-suggestion-' + childCategory;
	//header item
	// let headerText = response.data[0].Known_Problem;
	$divSuggestion = $('#suggestion-header-container').clone();
	$divSuggestion.addClass('suggestions-container');

	if (response.data.length > 0) {

		$divSuggestion.find('.suggestion-text').text('Asssociated ' + childCategory + 's');
		$divSuggestion.attr('id', containerID);
		//add click event to expand-contract
		$divSuggestion.find('.expand-contract').on("click", function (e) {
			$(e.currentTarget).parents('.suggestions-container').toggleClass('contracted');
		})
		//add click event to copy text
		$divSuggestion.find('.copy-orders').on("click", function (e) {
			let orderText = '';// $(e.currentTarget).siblings('.suggestion-text').text() + '\n';
			let orders = $(e.currentTarget).parents('.suggestions-container').find('.div-order.selected .order-text');
			orders.each(function (i, obj) {
				orderText += '\t' + $(obj).text() + '\n';
			})
			navigator.clipboard.writeText(orderText);
			showToastAlert("", "Selected Items have been Copied to the Clipboard.", "middle-center");
		});
		$('#sidebar-container').append($divSuggestion);

		//populate child divs
		for (i = 1; i < response.data.length; i++) {
			let itemText = (textField == '' ? '' : response.data[i][textField]);
			let itemDescription = (descriptionField == '' ? '' : response.data[i][descriptionField]);
			let itemScore = (scoreField == '' ? '' : response.data[i][scoreField]);
			let itemType = (typeField == '' ? '' : response.data[i][typeField]);

			let faIcon;
			let iconTitle;
			if (itemText != '') {
				$divOrder = $('#div-order-template').clone();
				switch (itemType) {
					case 'Lab':
						faIcon = "fa-flask";
						iconTitle = "Lab Test";
						break;
					case 'Prescription':
						faIcon = "fa-pills";
						iconTitle = "Prescription";
						break;
					case 'Procedure':
						faIcon = "fa-hospital-user";  //heart-pulse
						iconTitle = "Procedure";
						break;
				}

				$divOrder.find('.order-text').text(itemText);          //add order text
				if (itemDescription != '') {
					$divOrder.find('.order-description').attr('data-bs-original-title', itemDescription);       //add tooltip
				}
				if (itemType != '') {
					$divOrder.find('.order-type').addClass('fas ' + faIcon);
					$divOrder.find('.order-type').attr('title', iconTitle);
				}
				if (itemScore != '') {     //add tooltip
					$divOrder.find('.order-score').css('filter', 'brightness(' + (1 + (itemScore)) + ')');       //change brightness off score indicator
					$divOrder.find('.order-score').attr('data-bs-original-title', itemScore + '%');
				}
				$divOrder.removeAttr('id');
				let containerDiv = $('#sidebar-container').find('#' + containerID);

				//add click event to order for selections/deselections
				$divOrder.on("click", function (e) { $(e.currentTarget).toggleClass("selected") });

				containerDiv.append($divOrder);
			}
		}
	}
	else {
		$divSuggestion.find('.suggestion-text').text('We were not able to find any ' + childCategory + 's');
		$divSuggestion.addClass('is-empty');
		$divSuggestion.find('.expand-contract').addClass('d-none');
		$divSuggestion.find('.copy-orders').addClass('d-none');
		$('#sidebar-container').append($divSuggestion);
	}

}


//generic function to hide the toast alert
function hideToastAlert() {
	var myAlert = $("#mi1-toast")[0];
	if (myAlert) {
		var bsAlert = new bootstrap.Toast(myAlert);
		bsAlert.hide();
	}
}

//generic function to show the toast alert
function showToastAlert(title, message, position) {
	$("#toast-title").text(title);
	$("#toast-message").text(message);
	var myClass;
	switch (position) {
		case "top-left":
			myClass = "top-0 start-0";
			break;
		case "top-center":
			myClass = "top-0 start-50 translate-middle-x";
			break;
		case "top-right":
			myClass = "top-0 end-0";
			break;
		case "middle-left":
			myClass = "top-50 start-0 translate-middle-y";
			break;
		case "middle-center":
			myClass = "top-50 start-50 translate-middle";
			break;
		case "middle-right":
			myClass = "top-50 end-0 translate-middle-y";
			break;
		case "bottom-left":
			myClass = "bottom-0 start-0";
			break;
		case "bottom-center":
			myClass = "bottom-0 start-50 translate-middle-x";
			break;
		case "bottom-right":
			myClass = "bottom-0 end-0";
			break;
		default:
	}
	$("#mi1-toast").attr("class", "toast position-fixed p-3 " + myClass);
	$('.toast-header').toggleClass("d-none", title.length == 0);
	$('toast-body').toggleClass("d-none", message.length == 0);
	var myAlert = $("#mi1-toast")[0];
	if (myAlert) {
		var bsAlert = new bootstrap.Toast(myAlert);
		bsAlert.show();
	}
}

