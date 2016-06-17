//loads foundation base (responsive media queries etc.
$(document).foundation();

$(function() {

	// loads external svg as ajax so IE can get a grip.
	svg4everybody();

	// main image carousel thing
	// http://kenwheeler.github.io/slick/
	$('.record-imgpanel__slick').slick({
		dots: true,
		appendDots: $('.record-imgpanel__slickthumbs'),
		dotsClass: 'record-imgpanel__thumbnav',
		customPaging : function(slider, i) {
		var thumb = $(slider.$slides[i]).data('thumb');
		return '<a><img src="'+thumb+'"></a>';
		},
		infinite: true,
		speed: 300,
		slidesToShow: 1,
		centerMode: true,
		variableWidth: true,
		nextArrow: '<button type="button" data-role="none" class="slick-next slick-arrow" aria-label="Next" role="button"><svg width="32" height="56" viewBox="0 0 32 56" xmlns="http://www.w3.org/2000/svg"><path d="M21.267 27.87L6.077 50.592l3.326 2.224L26.088 27.87 9.316 3 6 5.236" fill="#FFF" fill-rule="evenodd"/></svg></button>',
		prevArrow: '<button type="button" data-role="none" class="slick-prev slick-arrow" aria-label="Previous" role="button"><svg width="32" height="56" viewBox="0 0 32 56" xmlns="http://www.w3.org/2000/svg"><path d="M10.82 27.87l15.19 22.722-3.326 2.224L6 27.87 22.77 3l3.318 2.236" fill="#FFF" fill-rule="evenodd"/></svg></button>'
	});

	// make carousel as big as we have screen room for.
	$('.cite__expand').on('click', function(){

		// one of either imgpanel__singleimg or imgpanel__slick will exist, and they should work the same
		var $thingsWithH = $('.record-imgpanel__slick, .record-imgpanel__slick .pic, .record-imgpanel__singleimg, .record-imgpanel__singleimg .pic');

		var maxH = $(window).height() - $('.record-imgpanel').height() + $('.record-imgpanel__slick').height() + $('.record-imgpanel__singleimg').height();
		var newPos = $('.record-imgpanel').offset().top;
		$('body').scrollTop(newPos);

		if($('.record-imgpanel').hasClass('record-imgpanel--expanded')) {
			$thingsWithH.height('');
			$('.record-imgpanel').removeClass('record-imgpanel--expanded');
			$(this).removeClass('cite__expand--expanded');
		} else {
			$thingsWithH.height(maxH);
			$('.record-imgpanel').addClass('record-imgpanel--expanded');
			$(this).addClass('cite__expand--expanded');
		};
	});

	// using bower / Clipboard for copying cite text. not really neceesary?
	// https://clipboardjs.com/
	var clipboard = new Clipboard('.clipboard');

	clipboard.on('success', function(e) {
		//console.info('Action:', e.action);
		//console.info('Text:', e.text);
		//console.info('Trigger:', e.trigger);
		$(e.trigger).addClass('clipboard--copied');
		setTimeout(function() { //to repeat copied anim
			$(e.trigger).removeClass('clipboard--copied');
		}, 2000);
		//e.clearSelection();
	});

	if ( $( "#openseadragon" ).length ) {
		var viewer = OpenSeadragon({
			 id: "openseadragon",
			 //element: $('.record-imgpanel__singleimg'),
			 prefixUrl: '/assets/img/openseadragon/',
			 toolbar: "openseadragon-toolbar",
			 zoomOutButton: "osd-zoomout",
			 zoomInButton: "osd-zoomin",
			 homeButton: "osd-home",
			 fullPageButton: "osd-fullpage",
			 //just using an example static image, will be swapped for some magic tiles
			 tileSources: {
	        type: 'image',
	        url:  '/assets/img/example/babbage/Babbages-Difference-Engine-No-2-1847-1849-drawings1111.jpg'
	    }
		});
		// hide fallback non-zoomable img
		$('#openseadragon .pic').hide();
	}
});

// -----------------------------------------------------------------

// everything below here is for demo purposes only and will hopefully be replaced.

$(function() {


	// fake filtering to show states
	$('.filter:not(.filter--uncollapsible)')
	.on('click', '.filter__name', function(e){
		if($(this).parent().hasClass('filter--open')) {
			$(this).parent().removeClass('filter--open');

			if($(this).parent().hasClass('filter--active')) {
				$(this).parent().removeClass('filter--active');
				$(this).siblings().find('[type=checkbox]').prop('checked', false);
			}
		} else {
			$(this).parent().addClass('filter--open');
		}
	})
	.on('click', '[type=checkbox]', function(e){
		var filtername = $(this).closest('.filter').data('filter');
		if( $(this).closest('.filter__options').find(':checked').length > 0 ) {
			$(this).closest('.filter').addClass('filter--active');
			//$('.searchbox__filters [data-filter='+filtername+']').show();
		} else {
			$(this).closest('.filter').removeClass('filter--active')
			//$('.searchbox__filters [data-filter='+filtername+']').hide();
		}
	});

	//fake function to act as temporary home button.
	//replace with a search engine or something;)
	$('.searchbox__submit').on('click', function(){
		window.location = "/index.html";
	});

	//html5 details element needs a js polyfill, so sod it
	$('.details__summary').on('click', function(e){
		var $d = $(this).parent();
		$d.attr('aria-expanded', ($d.attr('aria-expanded') == "true") ? false : true);
	});

	// autocomplete. https://github.com/twitter/typeahead.js
	var substringMatcher = function(strs) {
	  return function findMatches(q, cb) {
		var matches, substringRegex;

		// an array that will be populated with substring matches
		matches = [];

		// regex used to determine if a string contains the substring `q`
		var substrRegex = new RegExp(q, 'i');

		// iterate through the pool of strings and for any string that
		// contains the substring `q`, add it to the `matches` array
		$.each(strs, function(i, str) {
		  if (substrRegex.test(str)) {
			matches.push(str);
		  }
		});

		cb(matches);
	  };
	};

	// fake static data to test.
	var suggestions = ['Ada Lovelace', 'Agnes Arber', 'Ahmed Zewail', 'Al-Battani', 'Alan Turing', 'Albert Abraham Michelson', 'Albert Einstein', 'Alberto Santos-Dumont', 'Albrecht von Haller', 'Aldo Leopold', 'Alessandro Volta', 'Alexander Bain', 'Alexander Fleming', 'Alexander Graham Bell', 'Alexander Von Humboldt', 'Alfred Binet', 'Alfred Kinsey', 'Alfred Nobel', 'Alfred Russel Wallace', 'Alfred Wegener', 'Amedeo Avogadro', 'Anaximander', 'Anders Celsius', 'André Marie Ampère', 'Andreas Vesalius', 'Angel Alcala', 'Antoine Lavoisier', 'Antonie van Leeuwenhoek', 'Antonio Meucci', 'Archimedes', 'Aristarchus', 'Aristotle', 'Arnold Sommerfeld', 'Arthur Eddington', 'Avicenna', 'B. F. Skinner', 'Barbara McClintock', 'Beatrix Potter', 'Benjamin Franklin', 'Benjamin Thompson', 'Bernardo Houssay', 'Bill Nye', 'Blaise Pascal', 'Brahmagupta', 'Brian Cox', 'C. V. Raman', 'Carl Bosch', 'Carl Friedrich Gauss', 'Carl Sagan', 'Carolus Linnaeus', 'Charles Babbage', 'Charles Darwin', 'Charles Lyell', 'Charles Sherrington', 'Charles-Augustin de Coulomb', 'Chen-Ning Yang', 'Christiaan Huygens', 'Christiane Nusslein-Volhard', 'Clarence Birdseye', 'Claude Bernard', 'Claude Levi-Strauss', 'Clyde Tombaugh', 'Daniel Bernoulli', 'David Bohm', 'David Hilbert', 'Dian Fossey', 'Dmitri Mendeleev', 'Dorothy Hodgkin', 'E. O. Wilson', 'Edmund Halley', 'Edward Jenner', 'Edward Teller', 'Edwin Herbert Land', 'Edwin Hubble', 'Elizabeth Blackwell', 'Emil Fischer', 'Emil Kraepelin', 'Emile Berliner', 'Emmy Noether', 'Empedocles', 'Enrico Fermi', 'Eratosthenes', 'Ernest Lawrence', 'Ernest Rutherford', 'Ernst Haeckel', 'Ernst Mach', 'Ernst Mayr', 'Ernst Werner von Siemens', 'Erwin Chargaff', 'Erwin Schrodinger', 'Euclid', 'Evangelista Torricelli', 'Fibonacci', 'Francesco Redi', 'Francis Bacon', 'Francis Crick', 'Francis Galton', 'Franz Boas', 'Frederick Gowland Hopkins', 'Frederick Sanger', 'Frederick Soddy', 'Friedrich August Kekulé', 'Friedrich Wöhler', 'Fritz Haber', 'Galen', 'Galileo Galilei', 'Gene Shoemaker', 'Georg Ohm', 'George Gaylord Simpson', 'George Washington Carver', 'Georges-Louis Leclerc, Comte de Buffon', 'Gertrude Elion', 'Gerty Theresa Cori', 'Glenn Seaborg', 'Gottfried Leibniz', 'Gottlieb Daimler', 'Grace Murray Hopper', 'Gregor Mendel', 'Guglielmo Marconi', 'Gustav Kirchoff', 'Gustav Ludwig Hertz', 'Hans Christian Oersted', 'Hans Selye', 'Harold Urey', 'Harriet Quimby', 'Hedy Lamarr', 'Heinrich Hertz', 'Henri Becquerel', 'Henrietta Swan Leavitt', 'Henry Bessemer', 'Henry Cavendish', 'Henry Ford', 'Henry Moseley', 'Hermann Rorschach', 'Hermann von Helmholtz', 'Homi Jehangir Bhabha', 'Humphry Davy', 'Ibn Rushd', 'Inge Lehmann', 'Irene Joliot-Curie', 'Isaac Newton', 'Ivan Pavlov', 'J. J. Thomson', 'J. Robert Oppenheimer', 'J. Willard Gibbs', 'Jack Horner', 'Jacques Cousteau', 'Jagadish Chandra Bose', 'James Chadwick', 'James Clerk Maxwell', 'James Dwight Dana', 'James Hutton', 'James Prescott Joule', 'James Watson', 'James Watt', 'Jan Baptist von Helmont', 'Jane Goodall', 'Jane Marcet', 'Jean Piaget', 'Jean-Baptiste Lamarck', 'Jocelyn Bell Burnell', 'Johannes Kepler', 'John Dalton', 'John Locke', 'John Logie Baird', 'John Napier', 'John Needham', 'John Ray', 'John von Neumann', 'Jonas Salk', 'Joseph Banks', 'Joseph Henry', 'Joseph Lister', 'Joseph Priestley', 'Justus von Liebig', 'Karl Landsteiner', 'Katharine Burr Blodgett', 'Kip S. Thorne', 'Konrad Lorenz', 'Lee De Forest', 'Leonardo da Vinci', 'Leonhard Euler', 'Lester R. Brown', 'Linus Pauling', 'Lise Meitner', 'Louis Agassiz', 'Louis de Broglie', 'Louis Pasteur', 'Lucretius', 'Ludwig Boltzmann', 'Luigi Galvani', 'Luis Alvarez', 'Luther Burbank', 'Lynn Margulis', 'Mae Carol Jemison', 'Marcello Malpighi', 'Marguerite Perey', 'Maria Gaetana Agnesi', 'Maria Goeppert-Mayer', 'Maria Mitchell', 'Marie Curie', 'Mario Molina', 'Mary Anning', 'Max Born', 'Max Planck', 'Max von Laue', 'Michael E. Brown', 'Michael Faraday', 'Michio Kaku', 'Mohammad Abdus Salam', 'Muhammad ibn Musa al-Khwarizmi', 'Murray Gell-Mann', 'Nicolaus Copernicus', 'Niels Bohr', 'Nikola Tesla', 'Noam Chomsky', 'Omar Khayyam', 'Otto Hahn', 'Paul Dirac', 'Paul Ehrlich', 'Pierre Curie', 'Pierre de Fermat', 'Pierre-Simon Laplace', 'Prafulla Chandra Ray', 'Pythagoras', 'Rachel Carson', 'René Descartes', 'Richard Feynman', 'Rita Levi-Montalcini', 'Robert Bosch', 'Robert Boyle', 'Robert Brown', 'Robert Bunsen', 'Robert Goddard', 'Robert Hooke', 'Robert Koch', 'Ronald Fisher', 'Ronald Ross', 'Rosalind Franklin', 'Rudolf Christian Karl Diesel', 'Rudolf Virchow', 'Salim Ali', 'Sally Ride', 'Santiago Ramón y Cajal', 'Sergei Winogradsky', 'Sigmund Freud', 'Srinivasa Ramanujan', 'Stephanie Kwolek', 'Stephen Hawking', 'Subrahmanyan Chandrasekhar', 'Svante Arrhenius', 'Thabit ibn Qurra', 'Thales', 'Theodor Schwann', 'Theodosius Dobzhansky', 'Thomas Alva Edison', 'Thomas Hunt Morgan', 'Thomas Kuhn', 'Thomas Newcomen', 'Thomas Willis', 'Tim Noakes', 'Timothy John Berners-Lee', 'Tycho Brahe', 'Virginia Apgar', 'Vladimir Vernadsky', 'Werner Heisenberg', 'Wernher Von Braun', 'Wilbur and Orville Wright', 'Wilhelm Conrad Roentgen', 'Wilhelm Röntgen', 'Wilhelm Wundt', 'William Buckland', 'William Harvey', 'William Herschel', 'William Hopkins', 'William Ramsay', 'William Smith', 'William Thomson', 'Wolfgang Ernst Pauli', 'Zora Neale Hurston'
	];


	$('#searchbox [type=search]').typeahead({
	  minLength: 1,
	  highlight: true
	},
	{
	  name: 'suggestions',
	  source: substringMatcher(suggestions)
	});

	$('#searchbox [type=search]').bind('typeahead:render', function(ev,sug,flag,name) {
	  console.log('typeahead:render:' +sug);
	});

	$('#searchbox [type=search]').bind('typeahead:open', function() {
	  console.log('typeahead:open');
	});

	$('#searchbox [type=search]').bind('typeahead:close', function() {
	  console.log('typeahead:close');
	});

	$('#searchbox [type=search]').bind('typeahead:idle', function() {
	  console.log('typeahead:idle');
	});

	$('#searchbox [type=search]').bind('typeahead:change', function() {
	  console.log('typeahead:change');
	});
	// none of those events tell me when the suggestions box is visible!
});
