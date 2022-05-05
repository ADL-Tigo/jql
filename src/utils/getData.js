import '../utils/tableauwdc-2.2.latest'


const getData = (connectionType) => {
    const connector = tableau.makeConnector()

    connector.getSchema = (schemaCallback) => {
        let dataObj = JSON.parse(tableau.connectionData);
        let cols
        if (dataObj.connectionType === 'funnels') {
            cols = [
                { id: 'date', alias: 'Date', dataType: tableau.dataTypeEnum.date },
                { id: 'step', alias: 'Step', dataType: tableau.dataTypeEnum.string },
                { id: 'count', alias: 'Count', dataType: tableau.dataTypeEnum.int },
                { id: 'avg_time', alias: 'Avg Time', dataType: tableau.dataTypeEnum.int },
                { id: 'avg_time_from_start', alias: 'Avg Time From Start', dataType: tableau.dataTypeEnum.int },
                { id: 'event', alias: 'Event', dataType: tableau.dataTypeEnum.string },
                { id: 'overall_conv_ratio', alias: 'Overall Ratio', dataType: tableau.dataTypeEnum.float },
                { id: 'step_conv_ratio', alias: 'Step Ratio', dataType: tableau.dataTypeEnum.float },
            ];
        } else if (dataObj.connectionType === 'insights') {
            cols = [
                { id: 'event', alias: 'Event', dataType: tableau.dataTypeEnum.string },
                { id: 'segment', alias: 'Segment', dataType: tableau.dataTypeEnum.string },
                { id: 'property', alias: 'Property', dataType: tableau.dataTypeEnum.string },
                { id: 'subproperty', alias: 'Sub Property', dataType: tableau.dataTypeEnum.string },
                { id: 'subsegment', alias: 'Sub Segment', dataType: tableau.dataTypeEnum.string },
                { id: 'date', alias: 'Date', dataType: tableau.dataTypeEnum.date },
                { id: 'value', alias: 'Value', dataType: tableau.dataTypeEnum.float },
            ];
        } else if (dataObj.connectionType === 'jql') {
            cols = [
                { id: 'result', alias: 'Result', dataType: tableau.dataTypeEnum.string },
                { id: 'source', alias: 'Source', dataType: tableau.dataTypeEnum.string },
                { id: 'event', alias: 'event', dataType: tableau.dataTypeEnum.string },
                { id: 'contract', alias: 'contract', dataType: tableau.dataTypeEnum.string },
                { id: 'count_events', alias: 'Count events', dataType: tableau.dataTypeEnum.string },
                { id: 'month', alias: 'Month', dataType: tableau.dataTypeEnum.string },
                { id: 'id', alias: 'id', dataType: tableau.dataTypeEnum.string },
                { id: 'msisdn', alias: 'msisdn', dataType: tableau.dataTypeEnum.string },
            ]
        }

        const tableSchema = {
            id: 'Mixpanel_Connector',
            columns: cols
        }
        schemaCallback([tableSchema])
    }



    connector.getData = (table, doneCallback) => {
        let dataObj = JSON.parse(tableau.connectionData);
        let apiKey = dataObj.projectData ? dataObj.projectData.apiKey : process.env.COLOMBIA_KEY
        $.ajaxSetup({
            beforeSend: (xhr) => {
                xhr.setRequestHeader('Authorization', `Basic ${btoa(apiKey)}:`);
                xhr.setRequestHeader('Accept', 'application/json');
            }
        })
        let projectId = dataObj.projectData ? dataObj.projectData.id : 1503585
        let connectionURL
        let tableData = []
        if (dataObj.connectionType === 'funnels') {
            let currentDatetime = new Date(),
                currentMonth = currentDatetime.getMonth() + 1,
                pastMonth = currentMonth - 2,
                currentYear = currentDatetime.getFullYear();
            let fromDate = dataObj.startDate ? dataObj.startDate : `${currentYear}-${pastMonth}-01`
            let toDate = dataObj.endDate ? dataObj.endDate : `${currentYear}-${currentMonth}-${currentDatetime.getDate()}`
            let dates = `from_date=${fromDate}&to_date=${toDate}`
            connectionURL = `https://mixpanel.com/api/2.0/funnels?project_id=${projectId}&funnel_id=${dataObj.queryType}&${dates}&unit=month`;

            $.getJSON(connectionURL, (resp) => {
                const feat = resp.data
                for (const date in feat) {
                    for (const step in feat[date]) {
                        try {
                            if (feat[date][step])
                                feat[date][step].forEach(item => {
                                    tableData.push({
                                        'date': date,
                                        'step': step,
                                        'count': item.count,
                                        'avg_time': item.avg_time,
                                        'avg_time_from_start': item.avg_time_from_start,
                                        'event': item.event,
                                        'overall_conv_ratio': item.overall_conv_ratio,
                                        'step_conv_ratio': item.step_conv_ratio,
                                    });
                                })
                        } catch (TypeError) {
                            console.error("error: ", TypeError);

                        }
                    }
                }
                chunkData(table, tableData);
                doneCallback();
            })
        } else if (dataObj.connectionType === 'insights') {
            connectionURL = `https://mixpanel.com/api/2.0/insights?project_id=${projectId}&bookmark_id=${dataObj.queryType}`
            /*
            La función checkDate se encarga de verificar si el 
            valor del 1 parámetro corresponde a una fecha y en caso tal, 
            la convierte en un objeto date entendible por tableau
            El 2 parámetro corresponde al nombre de la columna visible en tableau, y en 
            caso de que sea a una fecha, la columna será "Date"
            
            Args:
            breakdown: Valor de desglose que se validará como fecha o no dentro de la función
            type: Nombre de la columna del valor
            weekDays: Dias de la semana para comprobar en caso de que el insight use un breakdown Date(week of day)
            */
            const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            let checkDate = (breakdown, type) => {
                let obj = {
                    'value': breakdown,
                    'key': type
                }
                let globalRegex = /[A-Z]/g;
                if (globalRegex.test(breakdown)) {
                    if (!weekDays.includes(breakdown)) {
                        let tempDate = new Date(breakdown)
                        if (tempDate.getTime()) {
                            obj['value'] = tempDate.toLocaleDateString()
                            obj['key'] = 'date'
                        }
                    } else {
                        obj['key'] = 'date'
                    }
                }
                return obj;
            }

            /*
            La función bkZero realizá la extracción del json para aquellos insights de 
            mixpanel con 0 breakdowns, insertando los valores
            en el arreglo 'tableData' que se enviará a Tableau

            Args:
            data: Objeto json correspondiente al insight de mixpanel
            */

            let bkZero = (data) => {

                for (let serie in data) {
                    for (let segment in data[serie]) {
                        tableData.push({
                            'event': serie,
                            'value': data[serie][segment]
                        })
                    }
                }

            }

            // Funciona igual como la función bkZero, sin embargo,
            // corresponde para insights con 1 breakdown
            let bkOne = (data) => {
                for (let serie in data) {
                    for (let segment in data[serie]) {
                        if (segment != '$overall') {
                            for (let property in data[serie][segment]) {
                                let obj = checkDate(segment, 'segment')
                                tableData.push({
                                    'event': serie,
                                    [obj['key']]: obj['value'],
                                    'value': data[serie][segment][property]
                                })
                            }
                        }
                    }
                }
            }

            // Funciona igual como la función bkZero, sin embargo,
            // corresponde para insights con 2 breakdowns
            let bkTwo = (data) => {
                for (let serie in data) {
                    for (let segment in data[serie]) {
                        for (let property in data[serie][segment]) {
                            if (property != '$overall') {
                                for (let subproperty in data[serie][segment][property]) {
                                    let obj01 = checkDate(segment, 'segment')
                                    let obj02 = checkDate(property, 'property')
                                    tableData.push({
                                        'event': serie,
                                        [obj01['key']]: obj01['value'],
                                        [obj02['key']]: obj02['value'],
                                        'value': data[serie][segment][property][subproperty]
                                    })
                                }
                            }
                        }
                    }
                }
            }

            // Funciona igual como la función bkZero, sin embargo,
            // corresponde para insights con 3 breakdowns
            let bkThree = (data) => {
                for (let serie in data) {
                    for (let segment in data[serie]) {
                        for (let property in data[serie][segment]) {
                            for (let subproperty in data[serie][segment][property]) {
                                if (subproperty != '$overall') {
                                    for (let value in data[serie][segment][property][subproperty]) {
                                        let obj01 = checkDate(segment, 'segment')
                                        let obj02 = checkDate(property, 'property')
                                        let obj03 = checkDate(subproperty, 'subproperty')
                                        tableData.push({
                                            'event': serie,
                                            [obj01['key']]: obj01['value'],
                                            [obj02['key']]: obj02['value'],
                                            [obj03['key']]: obj03['value'],
                                            'value': data[serie][segment][property][subproperty][value]
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Funciona igual como la función bkZero, sin embargo,
            // corresponde para insights con 4 breakdowns
            let bkFour = (data) => {
                for (let serie in data) {
                    for (let segment in data[serie]) {
                        for (let property in data[serie][segment]) {
                            for (let subproperty in data[serie][segment][property]) {
                                for (let subsegment in data[serie][segment][property][subproperty]) {
                                    if (subsegment != '$overall') {
                                        for (let value in data[serie][segment][property][subproperty][subsegment]) {
                                            let obj01 = checkDate(segment, 'segment')
                                            let obj02 = checkDate(property, 'property')
                                            let obj03 = checkDate(subproperty, 'subproperty')
                                            let obj04 = checkDate(subsegment, 'subsegment')
                                            tableData.push({
                                                'event': serie,
                                                [obj01['key']]: obj01['value'],
                                                [obj02['key']]: obj02['value'],
                                                [obj03['key']]: obj03['value'],
                                                [obj04['key']]: obj04['value'],
                                                'value': data[serie][segment][property][subproperty][subsegment][value]
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            $.getJSON(connectionURL, (resp) => {
                let feat = resp.series
                /*
                Esta función se encarga de obtener la profundidad de un json,
                recorriendolo mediante un foreach que llama la función de forma
                recursiva

                Args:
                obj: Es el json desglosado que se va a recorrer en cada recursión
                */
                let deep = (obj) => {
                    if (!obj || obj.length === 0 || typeof obj !== "object") return 0;
                    const keys = Object.keys(obj);
                    let depth = 0;
                    keys.forEach((key) => {
                        let tmpDepth = deep(obj[key]);
                        if (tmpDepth > depth) {
                            depth = tmpDepth;
                        }
                    });
                    return depth + 1;
                }

                /*
                Con este ciclo switch, se verificá la profundidad del json 'feat' mediante la función 'deep',
                para después ejecutar una función u otra dependiendo de la cantidad de profundidad, que a su vez
                corresponde a la cantidad de breakdowns que contenga el insight.
                */
                switch (deep(feat)) {
                    case 2:
                        bkZero(feat);
                        break;
                    case 3:
                        bkOne(feat);
                        break;
                    case 4:
                        bkTwo(feat);
                        break;
                    case 5:
                        bkThree(feat);
                        break;
                    case 6:
                        bkFour(feat);
                        break;
                    default:
                        console.log("Algo ha salido mal.");
                        break;
                }
                chunkData(table, tableData);
                doneCallback();
            })
        } else if (dataObj.connectionType === 'jql') {
            connectionURL = `https://mixpanel.com/api/2.0/jql?project_id=${projectId}`
            try {
                $.post(connectionURL, { 'script': dataObj.queryType }, (resp) => {
                    console.log(resp)
                    table.appendRows(resp);
                    doneCallback();
                })
            } catch (e) {
                console.error(e)
            }
        }
    }

    function chunkData(table, tableData) {
        let row_index = 0;
        let size = 100;
        while (row_index < tableData.length) {
            table.appendRows(tableData.slice(row_index, size + row_index));
            row_index += size;
            tableau.reportProgress("Getting row: " + row_index);
        }
    }

    tableau.registerConnector(connector)
    // Use if connection is in simulator WDC
    // if (!window.tableauVersionBootstrap) {
    //     var DOMContentLoaded_event = window.document.createEvent("Event")
    //     DOMContentLoaded_event.initEvent("DOMContentLoaded", true, true)
    //     window.document.dispatchEvent(DOMContentLoaded_event)
    // }
    $(document)
        .ready(() => {
            $('#submitButton')
                .click(() => {
                    let dataQuery
                    if (connectionType === 'funnels') {
                        dataQuery = {
                            queryType: $('#query_id').val().trim(),
                            startDate: $('#initial_date').val().trim(),
                            endDate: $('#final_date').val().trim()
                        };
                    } else if (connectionType === 'insights' || connectionType === 'jql') {
                        dataQuery = {
                            queryType: $('#query_id').val().trim(),
                        };
                    }
                    if (dataQuery.queryType) {
                        dataQuery.connectionType = connectionType

                        let projectData
                        const mixpanel_project = $('#mixpanel_project').val().trim();

                        switch (mixpanel_project){
                            case "gateway":
                                projectData = {
                                    id: 1495597,
                                    apiKey: process.env.GATEWAY_KEY
                                }
                                break;
                            case "mitigo":
                                projectData = {
                                    id: 1495617,
                                    apiKey: process.env.MITIGO_KEY
                                }
                                break;
                            default:
                                projectData = {
                                    id: 1503585,
                                    apiKey: process.env.COLOMBIA_KEY
                                }
                                break;
                        }
                        dataQuery.projectData = projectData;

                        tableau.connectionData = JSON.stringify(dataQuery);
                        tableau.connectionName = 'Mixpanel_Connector';
                        tableau.submit();

                    } else {
                        $('#errorMsg').html('ID is required');
                    }
                });
        });

}

export default getData