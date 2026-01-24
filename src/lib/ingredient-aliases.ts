/**
 * Ingredient alias mapping for intelligent combining
 * Maps common ingredient name variations to a canonical form
 */

const INGREDIENT_ALIASES: Record<string, string[]> = {
  // Herbs and seasonings
  'italian herbs': ['italian seasoning', 'italian herb blend', 'italian mixed herbs'],
  'garlic powder': ['garlic salt (garlic portion)', 'powdered garlic', 'garlic dust'],
  'onion powder': ['powdered onion', 'onion dust'],
  'black pepper': ['ground black pepper', 'cracked black pepper', 'pepper'],
  'sea salt': ['kosher salt', 'table salt', 'salt'],
  'paprika': ['smoked paprika', 'hungarian paprika', 'sweet paprika'],
  'chili powder': ['red pepper powder', 'chile powder', 'chilli powder'],
  'cayenne pepper': ['cayenne', 'red pepper', 'ground cayenne'],
  'cumin': ['ground cumin', 'cumin powder'],
  'oregano': ['dried oregano', 'fresh oregano'],
  'basil': ['dried basil', 'fresh basil'],
  'thyme': ['dried thyme', 'fresh thyme'],
  'rosemary': ['dried rosemary', 'fresh rosemary'],
  'parsley': ['dried parsley', 'fresh parsley', 'italian parsley'],
  'cilantro': ['fresh cilantro', 'coriander leaves'],
  'dill': ['dried dill', 'fresh dill', 'dill weed'],

  // Common ingredients
  'olive oil': ['extra virgin olive oil', 'virgin olive oil', 'pure olive oil'],
  'butter': ['unsalted butter', 'salted butter', 'margarine'],
  'milk': ['whole milk', 'skim milk', 'low-fat milk', '2% milk'],
  'yogurt': ['greek yogurt', 'plain yogurt', 'vanilla yogurt'],
  'cheese': ['cheddar cheese', 'mozzarella cheese', 'parmesan cheese'],
  'flour': ['all-purpose flour', 'wheat flour', 'bleached flour', 'unbleached flour'],
  'sugar': ['white sugar', 'granulated sugar', 'caster sugar'],
  'brown sugar': ['light brown sugar', 'dark brown sugar'],
  'honey': ['raw honey', 'organic honey'],
  'vinegar': ['white vinegar', 'apple cider vinegar', 'balsamic vinegar', 'red wine vinegar'],
  'soy sauce': ['low-sodium soy sauce', 'tamari', 'shoyu'],
  'tomato sauce': ['marinara sauce', 'tomato puree', 'tomato paste'],
  'chicken broth': ['chicken stock', 'chicken bouillon'],
  'beef broth': ['beef stock', 'beef bouillon'],
  'vegetable broth': ['vegetable stock'],

  // Vegetables
  'onion': ['yellow onion', 'white onion', 'red onion', 'sweet onion'],
  'garlic': ['garlic cloves', 'minced garlic', 'garlic puree'],
  'bell pepper': ['red bell pepper', 'green bell pepper', 'yellow bell pepper', 'orange bell pepper'],
  'tomato': ['fresh tomato', 'cherry tomato', 'roma tomato', 'beefsteak tomato'],
  'lettuce': ['romaine lettuce', 'iceberg lettuce', 'leaf lettuce', 'mixed greens'],
  'spinach': ['fresh spinach', 'baby spinach', 'frozen spinach'],
  'broccoli': ['fresh broccoli', 'broccoli florets', 'frozen broccoli'],
  'carrot': ['fresh carrot', 'baby carrot', 'shredded carrot'],
  'cucumber': ['english cucumber', 'regular cucumber'],
  'potato': ['russet potato', 'red potato', 'yellow potato'],
  'rice': ['white rice', 'brown rice', 'jasmine rice', 'basmati rice'],

  // Proteins
  'chicken': ['chicken breast', 'chicken thigh', 'ground chicken'],
  'beef': ['ground beef', 'beef steak', 'beef chuck', 'lean beef'],
  'pork': ['ground pork', 'pork chop', 'pork shoulder'],
  'salmon': ['atlantic salmon', 'wild salmon', 'salmon fillet'],
  'egg': ['chicken egg', 'whole egg', 'large egg'],

  // Dairy alternatives
  'almond milk': ['unsweetened almond milk', 'sweetened almond milk'],
  'coconut milk': ['canned coconut milk', 'fresh coconut milk'],
};

/**
 * Normalizes an ingredient name to a canonical form
 * Handles common aliases and variations
 */
export function normalizeIngredientName(name: string): string {
  const normalized = name.toLowerCase().trim();

  // Check if this name is an alias for another ingredient
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (canonical.toLowerCase() === normalized) {
      return canonical;
    }
    if (aliases.some(alias => alias.toLowerCase() === normalized)) {
      return canonical;
    }
  }

  // If no alias found, return the canonical form of the original
  return normalized;
}

/**
 * Checks if two ingredient names should be combined
 * Returns true only if they refer to the same ingredient
 */
export function shouldCombineIngredients(
  name1: string,
  name2: string,
  unit1: string,
  unit2: string,
  category1: string,
  category2: string
): boolean {
  // Different units or categories = don't combine
  if (unit1 !== unit2 || category1 !== category2) {
    return false;
  }

  // Normalize names and compare
  const normalized1 = normalizeIngredientName(name1);
  const normalized2 = normalizeIngredientName(name2);

  return normalized1 === normalized2;
}

/**
 * Gets the canonical (display) name for an ingredient
 */
export function getCanonicalIngredientName(name: string): string {
  const normalized = normalizeIngredientName(name);

  // Return the capitalized canonical form
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
