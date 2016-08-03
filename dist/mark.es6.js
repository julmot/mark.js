/*!***************************************************
 * mark.js v8.0.0
 * https://github.com/julmot/mark.js
 * Copyright (c) 2014–2016, Julian Motz
 * Released under the MIT license https://git.io/vwTVl
 *****************************************************/

"use strict";

((factory, window, document) => {
    if (typeof define === "function" && define.amd) {
        define([], () => {
            return factory(window, document);
        });
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory(window, document);
    } else {
        factory(window, document);
    }
})((window, document) => {
    class Mark {
        constructor(ctx) {
            this.ctx = ctx;
        }

        set opt(val) {
            this._opt = Object.assign({}, {
                "element": "",
                "className": "",
                "exclude": [],
                "iframes": false,
                "separateWordSearch": true,
                "diacritics": true,
                "synonyms": {},
                "accuracy": "partially",
                "acrossElements": false,
                "each": () => {},
                "noMatch": () => {},
                "filter": () => true,
                "done": () => {},
                "debug": false,
                "log": window.console,
                "caseSensitive": false
            }, val);
        }

        get opt() {
            return this._opt;
        }

        log(msg, level = "debug") {
            const log = this.opt.log;
            if (!this.opt.debug) {
                return;
            }
            if (typeof log === "object" && typeof log[level] === "function") {
                log[level](`mark.js: ${ msg }`);
            }
        }

        escapeStr(str) {
            return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        }

        createRegExp(str) {
            str = this.escapeStr(str);
            if (Object.keys(this.opt.synonyms).length) {
                str = this.createSynonymsRegExp(str);
            }
            if (this.opt.diacritics) {
                str = this.createDiacriticsRegExp(str);
            }
            str = this.createMergedBlanksRegExp(str);
            str = this.createAccuracyRegExp(str);
            return str;
        }

        createSynonymsRegExp(str) {
            const syn = this.opt.synonyms,
                  sens = this.opt.caseSensitive ? "" : "i";
            for (let index in syn) {
                if (syn.hasOwnProperty(index)) {
                    const value = syn[index],
                          k1 = this.escapeStr(index),
                          k2 = this.escapeStr(value);
                    str = str.replace(new RegExp(`(${ k1 }|${ k2 })`, `gm${ sens }`), `(${ k1 }|${ k2 })`);
                }
            }
            return str;
        }

        createDiacriticsRegExp(str) {
            const dct = ["a\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u0101\u0105", "A\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u0100\u0104", "c\u00e7\u0107\u010d", "C\u00c7\u0106\u010c", "d\u0111\u010f", "D\u0110\u010e", "e\u00e8\u00e9\u00ea\u00eb\u011b\u0113\u0119", "E\u00c8\u00c9\u00ca\u00cb\u011a\u0112\u0118", "i\u00ec\u00ed\u00ee\u00ef\u012b", "I\u00cc\u00cd\u00ce\u00cf\u012a", "l\u0142", "L\u0141", "n\u00f1\u0148\u0144", "N\u00d1\u0147\u0143", "o\u00f2\u00f3\u00f4\u00f5\u00f6\u00f8\u014d", "O\u00d2\u00d3\u00d4\u00d5\u00d6\u00d8\u014c", "r\u0159", "R\u0158", "s\u0161\u015b", "S\u0160\u015a", "t\u0165", "T\u0164", "u\u00f9\u00fa\u00fb\u00fc\u016f\u016b", "U\u00d9\u00da\u00db\u00dc\u016e\u016a", "y\u00ff\u00fd", "Y\u0178\u00dd", "z\u017e\u017c\u017a", "Z\u017d\u017b\u0179"],
                  sens = this.opt.caseSensitive ? "" : "i";
            let handled = [];
            str.split("").forEach(ch => {
                dct.every(dct => {
                    if (dct.indexOf(ch) !== -1) {
                        if (handled.indexOf(dct) > -1) {
                            return false;
                        }

                        str = str.replace(new RegExp(`[${ dct }]`, `gm${ sens }`), `[${ dct }]`);
                        handled.push(dct);
                    }
                    return true;
                });
            });
            return str;
        }

        createMergedBlanksRegExp(str) {
            return str.replace(/[\s]+/gmi, "[\\s]*");
        }

        createAccuracyRegExp(str) {
            let acc = this.opt.accuracy,
                val = typeof acc === "string" ? acc : acc.value,
                ls = typeof acc === "string" ? [] : acc.limiters,
                lsJoin = "";
            ls.forEach(limiter => {
                lsJoin += `|${ this.escapeStr(limiter) }`;
            });
            switch (val) {
                case "partially":
                    return `()(${ str })`;
                case "complementary":
                    return `()([^\\s${ lsJoin }]*${ str }[^\\s${ lsJoin }]*)`;
                case "exactly":
                    return `(^|\\s${ lsJoin })(${ str })(?=$|\\s${ lsJoin })`;
            }
        }

        getSeparatedKeywords(sv) {
            let stack = [];
            sv.forEach(kw => {
                if (!this.opt.separateWordSearch) {
                    if (kw.trim() && stack.indexOf(kw) === -1) {
                        stack.push(kw);
                    }
                } else {
                    kw.split(" ").forEach(kwSplitted => {
                        if (kwSplitted.trim() && stack.indexOf(kwSplitted) === -1) {
                            stack.push(kwSplitted);
                        }
                    });
                }
            });
            return {
                "keywords": stack.sort((a, b) => {
                    return b.length - a.length;
                }),
                "length": stack.length
            };
        }

        getContexts() {
            let ctx;
            if (typeof this.ctx === "undefined") {
                ctx = [];
            } else if (this.ctx instanceof HTMLElement) {
                ctx = [this.ctx];
            } else if (Array.isArray(this.ctx)) {
                ctx = this.ctx;
            } else {
                ctx = Array.prototype.slice.call(this.ctx);
            }
            if (!ctx.length) {
                this.log("Empty context", "warn");
            }
            return ctx;
        }

        getTextNodes(cb) {
            let val = "",
                nodes = [];
            this.forEachTextNode(node => {
                nodes.push({
                    start: val.length,
                    end: (val += node.textContent).length,
                    node
                });
            }, () => {
                cb({
                    value: val,
                    nodes: nodes
                });
            });
        }

        matches(el, selector) {
            return (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector);
        }

        matchesExclude(el, exclM) {
            let remain = true;
            let excl = this.opt.exclude.concat(["script", "style", "title"]);
            if (exclM) {
                excl = excl.concat(["*[data-markjs='true']"]);
            }
            excl.every(sel => {
                if (this.matches(el, sel)) {
                    return remain = false;
                }
                return true;
            });
            return !remain;
        }

        onIframeReady(ifr, successFn, errorFn) {
            try {
                const ifrWin = ifr.contentWindow,
                      bl = "about:blank",
                      compl = "complete",
                      callCallback = () => {
                    try {
                        if (ifrWin.document === null) {
                            throw new Error("iframe inaccessible");
                        }
                        successFn(ifrWin.document);
                    } catch (e) {
                        errorFn();
                    }
                },
                      isBlank = () => {
                    const src = ifr.getAttribute("src").trim(),
                          href = ifrWin.location.href;
                    return href === bl && src !== bl && src;
                },
                      observeOnload = () => {
                    const listener = () => {
                        try {
                            if (!isBlank()) {
                                ifr.removeEventListener("load", listener);
                                callCallback();
                            }
                        } catch (e) {
                            errorFn();
                        }
                    };
                    ifr.addEventListener("load", listener);
                };
                if (ifrWin.document.readyState === compl) {
                    if (isBlank()) {
                        observeOnload();
                    } else {
                        callCallback();
                    }
                } else {
                    observeOnload();
                }
            } catch (e) {
                errorFn();
            }
        }

        forEachIframe(ctx, cb, end) {
            let ifr = ctx.querySelectorAll("iframe");
            ifr = Array.prototype.slice.call(ifr);
            if (ifr.length) {
                ifr.forEach(ifr => {
                    this.onIframeReady(ifr, con => {
                        const html = con.querySelector("html");
                        this.forEachIframe(html, cb, () => {
                            cb(html);
                            end();
                        });
                    }, () => {
                        const src = ifr.getAttribute("src");
                        this.log(`iframe "${ src }" could not be accessed`, "warn");
                        end();
                    });
                });
            } else {
                end();
            }
        }

        forEachContext(cb, end) {
            const ctx = this.getContexts(),
                  callCallbacks = el => {
                cb(el);
                if (--open < 1) {
                    end();
                }
            };
            let open = ctx.length;
            if (open < 1) {
                end();
            }
            ctx.forEach(el => {
                if (this.opt.iframes) {
                    this.forEachIframe(el, cb, () => {
                        callCallbacks(el);
                    });
                } else {
                    callCallbacks(el);
                }
            });
        }

        forEachTextNode(cb, end) {
            let handled = [];
            this.forEachContext(ctx => {
                const isDescendant = handled.filter(handledCtx => {
                    return handledCtx.contains(ctx);
                }).length > 0;
                if (handled.indexOf(ctx) > -1 || isDescendant) {
                    return;
                }
                handled.push(ctx);
                const itr = document.createNodeIterator(ctx, NodeFilter.SHOW_TEXT, node => {
                    if (!this.matchesExclude(node.parentNode, true)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }, false);
                let node;
                while (node = itr.nextNode()) {
                    cb(node);
                }
            }, end);
        }

        wrapRangeInTextNode(node, start, end) {
            const hEl = !this.opt.element ? "mark" : this.opt.element,
                  startNode = node.splitText(start),
                  ret = startNode.splitText(end - start);
            let repl = document.createElement(hEl);
            repl.setAttribute("data-markjs", "true");
            if (this.opt.className) {
                repl.setAttribute("class", this.opt.className);
            }
            repl.textContent = startNode.textContent;
            startNode.parentNode.replaceChild(repl, startNode);
            return ret;
        }

        wrapRangeInMappedTextNode(dict, start, end, filterCb, eachCb) {
            dict.nodes.every((n, i) => {
                const sibl = dict.nodes[i + 1];
                if (typeof sibl === "undefined" || sibl.start > start) {
                    const s = start - n.start,
                          e = (end > n.end ? n.end : end) - n.start;
                    if (filterCb(n.node)) {
                        dict.nodes[i].node = this.wrapRangeInTextNode(n.node, s, e);

                        const startStr = dict.value.substr(0, n.start),
                              endStr = dict.value.substr(e + n.start);
                        dict.value = startStr + endStr;
                        dict.nodes.forEach((k, j) => {
                            if (j >= i) {
                                if (dict.nodes[j].start > 0 && j !== i) {
                                    dict.nodes[j].start -= e;
                                }
                                dict.nodes[j].end -= e;
                            }
                        });
                        end -= e;
                        eachCb(dict.nodes[i].node.previousSibling, n.start);
                        if (end > n.end) {
                            start = n.end;
                        } else {
                            return false;
                        }
                    }
                }
                return true;
            });
        }

        wrapMatches(regex, custom, filterCb, eachCb, endCb) {
            const matchIdx = custom ? 0 : 2;
            this.forEachTextNode(node => {
                let match;
                while ((match = regex.exec(node.textContent)) !== null) {
                    if (!filterCb(match[matchIdx], node)) {
                        continue;
                    }
                    let pos = match.index;
                    if (!custom) {
                        pos += match[matchIdx - 1].length;
                    }
                    node = this.wrapRangeInTextNode(node, pos, pos + match[matchIdx].length);
                    eachCb(node.previousSibling);

                    regex.lastIndex = 0;
                }
            }, endCb);
        }

        wrapMatchesAcrossElements(regex, custom, filterCb, eachCb, endCb) {
            const matchIdx = custom ? 0 : 2;
            this.getTextNodes(dict => {
                let match;
                while ((match = regex.exec(dict.value)) !== null) {
                    let start = match.index,
                        end = start + match[matchIdx].length;
                    if (!custom) {
                        start += match[matchIdx - 1].length;
                    }

                    this.wrapRangeInMappedTextNode(dict, start, end, node => {
                        return filterCb(match[matchIdx], node);
                    }, (node, lastIndex) => {
                        regex.lastIndex = lastIndex;
                        eachCb(node);
                    });
                }
                endCb();
            });
        }

        unwrapMatches(node) {
            const parent = node.parentNode;
            let docFrag = document.createDocumentFragment();
            while (node.firstChild) {
                docFrag.appendChild(node.removeChild(node.firstChild));
            }
            parent.replaceChild(docFrag, node);
            parent.normalize();
        }

        markRegExp(regexp, opt) {
            this.opt = opt;
            this.log(`Searching with expression "${ regexp }"`);
            let totalMatches = 0;
            const eachCb = element => {
                totalMatches++;
                this.opt.each(element);
            };
            this.wrapMatches(regexp, true, (match, node) => {
                return this.opt.filter(node, match, totalMatches);
            }, eachCb, () => {
                if (totalMatches === 0) {
                    this.opt.noMatch(regexp);
                }
                this.opt.done(totalMatches);
            });
        }

        mark(sv, opt) {
            this.opt = opt;
            const {
                keywords: kwArr,
                length: kwArrLen
            } = this.getSeparatedKeywords(typeof sv === "string" ? [sv] : sv);
            const sens = opt.caseSensitive ? "" : "i";
            let totalMatches = 0;
            if (kwArrLen === 0) {
                this.opt.done(totalMatches);
            }
            kwArr.forEach(kw => {
                let regex = new RegExp(this.createRegExp(kw), `gm${ sens }`),
                    matches = 0;
                this.log(`Searching with expression "${ regex }"`);
                let fn = "wrapMatches";
                if (this.opt.acrossElements) {
                    fn = "wrapMatchesAcrossElements";
                }
                this[fn](regex, false, (term, node) => {
                    return this.opt.filter(node, kw, matches, totalMatches);
                }, element => {
                    matches++;
                    totalMatches++;
                    this.opt.each(element);
                }, () => {
                    if (matches === 0) {
                        this.opt.noMatch(kw);
                    }
                    if (kwArr[kwArrLen - 1] === kw) {
                        this.opt.done(totalMatches);
                    }
                });
            });
        }

        unmark(opt) {
            this.opt = opt;
            let sel = this.opt.element ? this.opt.element : "*";
            sel += "[data-markjs]";
            if (this.opt.className) {
                sel += `.${ this.opt.className }`;
            }
            this.log(`Removal selector "${ sel }"`);
            this.forEachContext(ctx => {
                const matches = ctx.querySelectorAll(sel);
                Array.prototype.slice.call(matches).forEach(el => {
                    if (!this.matchesExclude(el, false)) {
                        this.unwrapMatches(el);
                    }
                });
            }, this.opt.done);
        }

    }

    window.Mark = function (ctx) {
        const instance = new Mark(ctx);
        this.mark = (sv, opt) => {
            instance.mark(sv, opt);
            return this;
        };
        this.markRegExp = (sv, opt) => {
            instance.markRegExp(sv, opt);
            return this;
        };
        this.unmark = opt => {
            instance.unmark(opt);
            return this;
        };
        return this;
    };

    return window.Mark;
}, window, document);
