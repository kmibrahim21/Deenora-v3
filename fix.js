const fs = require('fs');
const file = 'src/components/results/engines/school/SchoolResultEngine.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`                                                    lang
                                                );
                                              }
                                          }}`,
`                                                    lang
                                                );
                                                });
                                              }
                                          }}`
);
fs.writeFileSync(file, content);
