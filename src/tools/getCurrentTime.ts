export const getCurrentTimeDefinition = {
    name: 'get_current_time',
    description: 'Get the current local time of the user/system',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export function getCurrentTime() {
    return new Date().toISOString();
}
