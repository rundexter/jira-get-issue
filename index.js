var JiraApi = require('jira').JiraApi,
    querystring = require('querystring'),
    _ = require('lodash');

var globalPickResults = {
    'self': 'self',
    project_name: 'fields.project.name',
    summary: 'fields.summary',
    description: 'fields.description',
    timetracking_timeSpent: 'fields.timetracking.timeSpent',
    attachment_self: {
        keyName: 'fields.attachment',
        fields: [
            'self'
        ]
    },
    comment_author_name: {
        keyName: 'fields.comment.comments',
        fields: [
            'author.name'
        ]
    },
    comment_body: {
        keyName: 'fields.comment.comments',
        fields: [
            'body'
        ]
    }
};

module.exports = {

    /**
     * Return pick result.
     *
     * @param output
     * @param pickTemplate
     * @returns {*}
     */
    pickResult: function (output, pickTemplate) {
        var result = _.isArray(pickTemplate)? [] : {};
        // map template keys
        _.map(pickTemplate, function (templateValue, templateKey) {

            var outputValueByKey = _.get(output, templateValue.keyName || templateValue, undefined);

            if (_.isUndefined(outputValueByKey))
                return result;

            // if template key is object - transform, else just save
            if (_.isArray(pickTemplate)) {

                result = outputValueByKey;
            } else if (_.isObject(templateValue)) {
                // if data is array - map and transform, else once transform
                if (_.isArray(outputValueByKey)) {
                    var mapPickArrays = this._mapPickArrays(outputValueByKey, templateKey, templateValue);

                    result = _.isEmpty(result)? mapPickArrays : _.merge(result, mapPickArrays);
                } else {

                    result[templateKey] = this.pickResult(outputValueByKey, templateValue.fields);
                }
            } else {

                _.set(result, templateKey, outputValueByKey);
            }
        }, this);

        return result;
    },

    /**
     * System func for pickResult.
     *
     * @param mapValue
     * @param templateKey
     * @param templateObject
     * @returns {*}
     * @private
     */
    _mapPickArrays: function (mapValue, templateKey, templateObject) {
        var arrayResult = [],
            result = templateKey === '-'? [] : {};

        _.map(mapValue, function (inOutArrayValue) {

            arrayResult.push(this.pickResult(inOutArrayValue, templateObject.fields));
        }, this);

        if (templateKey === '-') {

            result = arrayResult;
        } else {

            result[templateKey] = arrayResult;
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

        if (!dexter.environment('jira_host') || !dexter.environment('jira_user') || !dexter.environment('jira_password')) {

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
            issue = issue.concat('?' + querystring.encode(queryData));

        return issue;
    },

    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {

        var auth = this.authParams(dexter);
        if (!step.input('issue').first()) {

            this.fail('A [issue] input need for this module.');
            return;
        }

        if (!auth)
            return;

        var issue = this.issueString(step);
        var jira = new JiraApi(auth.protocol, auth.host, auth.port, auth.user, auth.password, auth.apiVers);

        jira.findIssue(issue, function (error, issue) {

            if (error)
                this.fail(error);
            else
                this.complete(this.pickResult(issue, globalPickResults));
        }.bind(this));
    }
};
