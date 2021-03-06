import { timeline, query, searchBody, queryBool, queryMulti, queryMust, queryMustNot, queryShould, queryWild } from './types/query';

export function queryBuilder(queryBody: searchBody, timeline: timeline): query {

    let query: query = { size: 100, query: {} };
    let queryBool: queryBool = { bool: {} };
    let queryMulti: queryMulti = { multi_match: {} };
    let queryMust: queryMust = { must: [] };
    let queryMustNot: queryMustNot = { must_not: [] };
    let queryShould: queryShould = { should: [] };
    let queryWild: queryWild = { wildcard: {} };

    let isBoolQuery: boolean = false;
    let isMultiMatchQuery: boolean = false;
    let isWildQuery: boolean = false;

    // Define timeline
    () => queryMust.must.push(rTimeline(timeline))

    if (queryBody.quote.length > 0) {
        isBoolQuery = true;
        for (let quote of queryBody.quote) queryMust.must.push({
            term: {
                label_index: quote.value
            }
        });
    }
    //QUERY BY FILE TYPE
    if (queryBody.file.length > 0) {
        isBoolQuery = true;
        for (let file of queryBody.file) {
            let file_value = file.value;
            queryMust.must.push({
                match: {
                    "file_properties.extension": file_value
                }
            });
        }
    }
    //QUERY BY DEPARTMENT
    if (queryBody.folder.length > 0) {
        isBoolQuery = true;
        for (let folder of queryBody.folder) {
            queryMust.must.push({
                term: {
                    metadata: folder.value
                }
            });
        }
    }

    //QUERY WITH MUST_NOT ON LABEL AND METADATA
    if (queryBody.minus.length > 0) {
        isBoolQuery = true;
        for (let minus of queryBody.minus) queryMustNot.must_not.push({
            multi_match: {
                query: minus.value,
                fields: ['label_index', 'metadata']
            }
        });
    }

    // QUERY WITH WILDCARD
    if (queryBody.wildcard.length > 0) {
        queryMust.must.push({ wildcard: { label_index: { value: queryBody.wildcard[0].value } } });
    }

    //MULTIMATCH
    if (queryBody.general.length > 0) {
        let data = '';
        for (let searchterm of queryBody.general) {
            if (searchterm.value !== "") {
                if (!data) data = searchterm.value;
                else data += ' ' + searchterm.value;
            }
        }

        let general = {
            query: data,
            fields: ["label_index", "metadata"]
        };

        queryMulti.multi_match = general;

        if (isBoolQuery) {
            queryMust.must.push(queryMulti);
            if (queryShould.should.length !== 0) queryBool.bool = Object.assign(queryBool.bool, { minimum_should_match: 1 }); //testing this
        }
        else isMultiMatchQuery = true;
    }

    if (isBoolQuery) {
        if (queryMust.must.length > 0) queryBool.bool = Object.assign(queryBool.bool, queryMust);
        if (queryMustNot.must_not.length > 0) queryBool.bool = Object.assign(queryBool.bool, queryMustNot);
        if (queryShould.should.length > 0) queryBool.bool = Object.assign(queryBool.bool, queryShould);
        if (Object.getOwnPropertyNames(queryBool.bool).length > 0) query.query = Object.assign(query.query, queryBool);
    }
    
    if (isWildQuery) {
        if (Object.getOwnPropertyNames(queryWild.wildcard).length > 0) query.query = Object.assign(query, queryWild);
    }
    else if (isMultiMatchQuery) {
        if (Object.getOwnPropertyNames(queryMulti.multi_match).length > 0) query.query = Object.assign(query.query, queryMulti);
    }

    return query;
}

function rTimeline(timeline: timeline){
    let timezone = "+01:00";
    let date_gte = "now-2y"; //"now-1d", "now-1y", "2020-11-18||/M"
    let date_lte = "now";

    return {
        range: {
            "file_properties.mod": {
                time_zone: timezone,
                gte: timeline.start || date_gte,
                lte: timeline.end || date_lte
            }
        }
    }
}