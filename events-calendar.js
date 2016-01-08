(function(angular) { 'use strict';

angular.module('eventsCalendar', [])
  .directive('eventsCalendar', function() {
    var template = '<div class="events-calendar-wrap">' + 
      '<div ng-class="[\'events-calendar\'].concat(selectionClasses)">' +
      '<div ng-class="\'week\'" ng-repeat="w in weeks">' +
        '<div ng-repeat="day in w.days" ng-class="[\'day\'].concat(day.class)" inject ng-click="selecting(day)">' +
        '</div>' +
      '</div>' +
      '</div>' +
    '</div>';
    
    var directive = {
      restrict: 'E',
      scope: {
        events: '=?events',
        since: '@since',
        upto: '@upto',
        selected: '=?selected',
        selectable: '@selectable',
        intensities: '=?intensities'
      },
      transclude: true,
      template: template,
      link: link
    };
    
    function link(scope, element, attrs) {
      var dateModifierFn = function(ΔY, ΔM, ΔD) {
        return function(date) {
          if (typeof date === 'string' || typeof date === 'number') {
            date = new Date(date);
          }
          
          return new Date(Date.UTC(
            date.getUTCFullYear() + ΔY,
            date.getUTCMonth()    + ΔM,
            date.getUTCDate()     + ΔD
          ));
        };
      };
      
      var normalizeToDay = dateModifierFn(0, 0, 0);
      var decYear = dateModifierFn(-1, 0, 0);
      var incDay = dateModifierFn(0, 0, 1);
      var decDay = dateModifierFn(0, 0, -1);
      
      scope.events = scope.events || [];
      
      attrs.$observe('events', update);
      attrs.$observe('upto',   update);
      attrs.$observe('since',  update);
      
      var selectedElement;
      scope.selectionClasses = [];
      scope.selecting = function(day) {
        if (scope.selectable === 'false')
          return;
        
        if (selectedElement) {
          // remove "selected" class from corresponding day element
          selectedElement.class = selectedElement.class.filter(function(c) {
            return c !== 'selected';
          });
        }
        
        if (day.class.indexOf('empty') !== -1) {
          selectedElement = null;
          scope.selected = null;
          scope.selectionClasses = [];
          return;
        }
        
        selectedElement = day;
        selectedElement.class.push('selected');
        scope.selected = day.date;
        scope.selectionClasses = ['selection-applied'];
      };
      
      function update() {
        scope.upto = normalizeToDay(attrs.upto || new Date());
        scope.since = normalizeToDay(attrs.since || decYear(scope.upto));
        scope.intensities = scope.intensities || 4;
        scope.selected = attrs.selected || null;
        scope.selectable = attrs.selectable || 'true';
        
        if (scope.since > scope.upto) {
          throw new Error('Invalid dates specified for events-calendar');
        }
        
        var countEventsForDay;
        if (typeof scope.events === 'function') {
          countEventsForDay = scope.events;
        } else {
          var lookupByDay = {};
          for (var i = 0; i < scope.events.length; ++i) {
            var normalizedDay = normalizeToDay(new Date(scope.events[i].day)).toJSON();
            lookupByDay[normalizedDay] = scope.events[i].count;
          }
          
          countEventsForDay = function(d) {
            return lookupByDay[normalizeToDay(d).toJSON()] || 0;
          };
        }

        scope.weeks = [];
        scope.days = [];
        
        var currentWeek = null;
        
        // first run: create all day objects, count events
        for (var d = scope.since; d <= scope.upto; d = incDay(d)) {
          if (currentWeek === null) {
            currentWeek = {
              days: []
            };
            
            scope.weeks.push(currentWeek);
          }
          
          var nEvents = countEventsForDay(d);
          var day = {
            date: d,
            class: ['filled'],
            events: nEvents
          };
          
          currentWeek.days.push(day);
          scope.days.push(day);
          
          if (d.getUTCDay() === 0) {
            currentWeek = null;
          }
        }
        
        var firstWeek = scope.weeks[0],
            lastWeek = scope.weeks[scope.weeks.length - 1];
        
        while (firstWeek.days.length < 7) {
          firstWeek.days.unshift({
            date: decDay(firstWeek.days[0].date),
            class: ['empty'],
            events: 0
          });
        }
        
        while (lastWeek.days.length < 7) {
          lastWeek.days.push({
            date: incDay(lastWeek.days[lastWeek.days.length-1].date),
            class: ['empty'],
            events: 0
          });
        }
        
        // second run: calculate intensities
        var counts = scope.days.map(function(day) {
          return day.events;
        }).filter(function(a) { return a; }).sort(function(a, b) { return a - b; });
        
        var percentileValues = [];
        for (var i = 0; i < scope.intensities; ++i) {
          percentileValues[i] = counts[parseInt(counts.length * i / scope.intensities)];
        }
        
        scope.days.forEach(function(day) {
          var i;
          
          for (i = 0; i < percentileValues.length; ++i) {
            if (day.events < percentileValues[i] || !day.events) {
              break;
            }
          }
          
          day.class.push('events-' + i);
        });
      }
    }
    
    return directive;
  })
  // https://github.com/angular/angular.js/issues/7874#issuecomment-47647528
  .directive('inject', function(){
    return {
      link: function($scope, $element, $attrs, controller, $transclude) {
        if (!$transclude) {
          throw minErr('ngTransclude')('orphan',
           'Illegal use of ngTransclude directive in the template! ' +
           'No parent directive that requires a transclusion found. ' +
           'Element: {0}',
           startingTag($element));
        }
        var innerScope = $scope.$new();
        $transclude(innerScope, function(clone) {
          $element.empty();
          $element.append(clone);
          $element.on('$destroy', function() {
            innerScope.$destroy();
          });
        });
      }
    };
  });

})(angular);
