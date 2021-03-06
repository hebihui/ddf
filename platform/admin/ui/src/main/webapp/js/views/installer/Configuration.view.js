/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global define*/
/** Main view page for add. */
define([
    'marionette',
    'icanhaz',
    'underscore',
    'backbone',
    'jquery',
    'text!templates/installer/configuration.handlebars',
    'text!templates/installer/configurationItem.handlebars',
    './Certificate.view.js',
    '../../models/installer/CertsModel.js',
    '../../models/installer/Configuration.js',
    'modelbinder',
    'perfectscrollbar',
    'multiselect'
    ], function (Marionette, ich, _, Backbone, $, configurationTemplate, configurationItemTemplate, CertificateView, CertificateModel, ConfigurationModel) {

    ich.addTemplate('configurationTemplate', configurationTemplate);
    ich.addTemplate('configurationItemTemplate', configurationItemTemplate);

    var systemProperties = new ConfigurationModel.SystemProperties();
    systemProperties.fetch({});
/*
* Layout
*/
    var ConfigurationView = Marionette.Layout.extend({
        template: 'configurationTemplate',
        className: 'full-height',
        model: systemProperties,
        regions: {
            configurationItems: '#config-form',
            certificates: '#certificate-configuration'
        },

        initialize: function (options) {

            this.navigationModel = options.navigationModel;
            this.navigationModel.set('hidePrevious', true);

            this.certificateModel = new CertificateModel();

            this.listenTo(this.navigationModel,'next', this.next);
        },
        modelEvents: {
            'change': function() {
                this.navigationModel.set('modified', true);
            }
        },

        next: function() {
            var layout = this;

            // loop through models and check for hostname change, validation errors and set redirect url
            var hostChange = true;
            var hostName;
            var port;
            var hasErrors = false;

            this.model.each(function (model) {
                hasErrors = hasErrors || model.validationError;

                if (model.get('title') === 'Host') {
                    hostName = model.get('value');
                    layout.certificateModel.set('hostName', hostName);
                    if (model.get('value') === model.get('defaultValue')) {
                        hostChange = false;
                    }
                } else if (model.get('title') === 'HTTPS Port') {
                    port = model.get('value');
                }
            });
            layout.navigationModel.set('redirectUrl', 'https://' + hostName + ':' + port + '/admin/index.html');


            if (!hasErrors) {

                var propertySave = this.model.save();
                if (propertySave) {
                    propertySave.done(function () {
                        if (hostChange) {

                            var certSave = layout.certificateModel.save();
                            if (certSave) {

                                certSave.done(function () {
                                    if(_.isEmpty(layout.certificateModel.get('certErrors'))){
                                        layout.navigationModel.nextStep('', 100);
                                    } else {
                                        layout.navigationModel.nextStep('Unable to save certificates. Check errors messages.', 0);
                                    }
                                });

                                certSave.fail(function () {
                                    layout.navigationModel.nextStep('Unable to save certificates: check logs', 0);
                                });

                            } else {
                                layout.navigationModel.nextStep('Certificate validation failed. Check inputs', 0);
                            }

                        } else {
                            layout.navigationModel.nextStep('', 100);
                        }
                    });

                    propertySave.fail(function () {
                        layout.navigationModel.nextStep('Unable to Save Configuration: check logs', 0);
                    });

                } else {
                    layout.navigationModel.nextStep('System property validation failed. Check inputs.', 0);
                }
            } else {
                layout.navigationModel.nextStep('System property validation failed. Check inputs.', 0);
            }

        },
        onRender: function () {
            var view = this;

            var sysPropsView = new SystemPropertiesView({collection: this.model});
            var certificateView =  new CertificateView({model: this.certificateModel});

            this.configurationItems.show(sysPropsView);
            this.certificates.show(certificateView);

            _.defer(function () {
                view.$('#system-configuration-settings').perfectScrollbar({useKeyboard: false});
            });
        }
    });

/*
* Item View
*/
var SystemPropertyView = Marionette.ItemView.extend({
    template: 'configurationItemTemplate',
    className: 'property-item col-md-6',
    initialize: function () {
        this.modelBinder = new Backbone.ModelBinder();
    },
    setupPopOvers: function() {

        var tooltipOptions = {
            content: this.model.get('description'),
            placement: 'bottom',
            trigger: 'hover'
        };

        var tooltipSelector = '[data-toggle="' + this.model.get('key') + '-popover"]';
        this.$el.find(tooltipSelector).popover(tooltipOptions);
    },
    onRender: function () {
        var bindings = Backbone.ModelBinder.createDefaultBindings(this.el, 'name');
        this.modelBinder.bind(this.model, this.el, bindings, {modelSetOptions: {validate: true}});
        this.setupPopOvers();
    },
    modelEvents: {
        'change': 'render'
    }
});

    /*
     * Collection View
     */
    var SystemPropertiesView = Marionette.CollectionView.extend({
        className: 'row',
        itemView: SystemPropertyView
    });

    return ConfigurationView;
});