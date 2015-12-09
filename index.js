var JiraApi = require('jira').JiraApi,
    querystring = require('querystring'),
    _ = require('lodash');

var globalPickResult = {
    'self': 'self',
    'fields.project.name': 'project_name',
    'fields.summary': 'summary',
    'fields.description': 'description',
    'fields.attachment': {
        key: 'attachment_self',
        fields: {
            self: 'self'
        }
    },
    'fields.comment.body': 'comment_body',
    'fields.comment.comments': {
        key: 'comment_author_name',
        fields: {
            'author.name': 'author_name',
            'body': 'body'
        }
    },
    'fields.timetracking.timeSpent': 'timetracking_timeSpent'
};

module.exports = {

    /**
     * Return pick result.
     *
     * @param output
     * @param pickResult
     * @param pickTemplate
     * @returns {*}
     */
    pickResult: function (output, pickTemplate) {
        var result = {};
        // map template keys
        _.map(_.keys(pickTemplate), function (templateKey) {

            var oneTemplateObject = pickTemplate[templateKey];
            var outputKeyValue = _.get(output, templateKey, undefined);

            if (_.isUndefined(outputKeyValue)) {

                return result;
            }
            // if template key is object - transform, else just save
            if (_.isObject(oneTemplateObject)) {
                // if data is array - map and transform, else once transform
                if (_.isArray(outputKeyValue)) {

                    result = _.merge(result, this._mapPickArrays(outputKeyValue, oneTemplateObject));
                } else {

                    result[oneTemplateObject.key] = this.pickResult(outputKeyValue, oneTemplateObject.fields);
                }
            } else {

                _.set(result, oneTemplateObject, outputKeyValue);
            }
        }, this);

        return result;
    },

    /**
     * System func for pickResult.
     *
     * @param mapValue
     * @param templateObject
     * @returns {*}
     * @private
     */
    _mapPickArrays: function (mapValue, templateObject) {

        var arrayResult = [],
            result = templateObject.key? {} : [];

        _.map(mapValue, function (inOutArrayValue) {

            arrayResult.push(this.pickResult(inOutArrayValue, templateObject.fields));
        }, this);

        if (templateObject.key) {

            result[templateObject.key] = arrayResult;
        } else {

            result = arrayResult;
        }

        return result;
    },

    /**
     * Return auth object.
     *
     *
     * @param dexter
     * @returns {*}
     */
    authParams: function (dexter) {
        var auth = {
            protocol: dexter.environment('jira_protocol', 'https'),
            host: dexter.environment('jira_host'),
            port: dexter.environment('jira_port', 443),
            user: dexter.environment('jira_user'),
            password: dexter.environment('jira_password'),
            apiVers: dexter.environment('jira_apiVers', '2')
        };

        if (!dexter.environment('jira_host') || !dexter.environment('user') || !dexter.environment('password')) {

            this.fail('A [jira_protocol, jira_port, jira_apiVers, *jira_host, *jira_user, *jira_password] environment has this module (* - required).');

            return false;
        } else {

            return auth;
        }
    },

    issueString: function (step) {
        var issue = step.input('issue').first(),
            queryData = {};

        if (step.input('fields').first())
            queryData.fields = step.input('fields').first();

        if (step.input('expand').first())
            queryData.expand = step.input('expand').first();

        if (!_.isEmpty(queryData))
            issue.concat('?' + querystring.encode(queryData));

        return issue;
    },

    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {

        if (step.input('issue').first()) {

            var issue = this.issueString(step);

            jira.findIssue(issue, function (error, issue) {
                console.log(issue);

                if (error)
                    this.fail(error);
                else
                    this.complete(this.pickResult(issue, globalPickResult));
            }.bind(this));
        } else {

            this.fail('A [issue] input need for this module.');
        }
    }
};
