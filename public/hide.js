// Hides filterpanel by default if javascript is enabled
if (!document.querySelector('input.filter__box:checked')) {
  document.getElementById('searchresults').className = 'row searchresults';
  document.getElementById('filtercolumn').className = 'filtercolumn';
  document.getElementById('control--filters').className = 'control control--filters';
  document.querySelector('button.filterpanel__button').className = 'hidden';
}
