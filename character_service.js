let CHARACTERS = [];

export const loadCharacters = async () => {
    try {
        const response = await fetch('./characters.json');
        CHARACTERS = await response.json();
        return CHARACTERS;
    } catch (error) {
        console.error("Error loading characters:", error);
        return [];
    }
};

export const getCharacters = () => CHARACTERS;
